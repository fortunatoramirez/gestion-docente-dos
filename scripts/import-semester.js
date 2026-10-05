require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');
const migrate = require('./migrate-semesters');
const { normalizeCatalogName, stripAccents } = require('../src/utils/text');
const { hashPassword } = require('../src/utils/passwords');
const { admissible } = require('../src/utils/semesterAccess');
const storage = require('../src/services/evidenceStorage');

function validateData(data) {
  const seen = new Set();
  let count = 0;
  const names = new Set();
  for (const professor of data.profesores) {
    if (!/^\d+$/.test(professor.numero_empleado) || !professor.nombre_fuente || !professor.materias.length) throw new Error('Profesor incompleto en la fuente.');
    if (seen.has(professor.numero_empleado)) throw new Error('Número de empleado duplicado en la fuente.');
    seen.add(professor.numero_empleado);
    const keys = new Set();
    for (const subject of professor.materias) {
      if (!subject.nombre_carga || !subject.clave_grupo || !Number.isInteger(subject.creditos)) throw new Error('Asignación incompleta.');
      if (!admissible({ semester: data.semestre.codigo, group_code: subject.clave_grupo }, professor.numero_empleado)) throw new Error('La fuente incluye una asignación excluida.');
      const key = `${normalizeCatalogName(subject.nombre_carga)}|${subject.clave_grupo}`;
      if (keys.has(key)) throw new Error('Asignación duplicada en la fuente.');
      keys.add(key);
      names.add(normalizeCatalogName(subject.nombre_carga));
      count += 1;
    }
  }
  if (data.profesores.length !== data.totales.profesores_con_asignaciones || count !== data.totales.asignaciones_a_cargar || names.size !== data.totales.nombres_distintos_materia_a_cargar) throw new Error('Los totales de la fuente no coinciden.');
}

function uniqueMatch(rows, predicate, label) {
  const matches = rows.filter(predicate);
  if (matches.length > 1) throw new Error(`Coincidencia ambigua: ${label}`);
  return matches[0];
}

function buildPlan(data, existingProfessors, existingSubjects, existingAssignments) {
  const professors = [];
  const subjects = new Map();
  const assignments = [];
  const nameMatches = [];
  for (const source of data.profesores) {
    let existing = uniqueMatch(existingProfessors, (row) => row.employee_number === source.numero_empleado, source.numero_empleado);
    if (!existing) {
      existing = uniqueMatch(existingProfessors, (row) => normalizeCatalogName(row.full_name) === normalizeCatalogName(source.nombre_fuente), source.nombre_fuente);
      if (existing && existing.employee_number && existing.employee_number !== source.numero_empleado) throw new Error(`El nombre ${source.nombre_fuente} ya está asociado al empleado ${existing.employee_number}.`);
    }
    const professor = { source, existing, id: existing && existing.id };
    professors.push(professor);
    for (const entry of source.materias) {
      const name = normalizeCatalogName(entry.nombre_carga);
      if (!subjects.has(name)) {
        let subject = uniqueMatch(existingSubjects, (row) => normalizeCatalogName(row.name) === name, name);
        if (!subject) {
          subject = uniqueMatch(existingSubjects, (row) => stripAccents(normalizeCatalogName(row.name)) === stripAccents(name), name);
          if (subject) nameMatches.push({ source: name, existing: subject.name, id: subject.id });
        }
        subjects.set(name, { name, existing: subject, id: subject && subject.id, credits: entry.creditos });
      }
      const subject = subjects.get(name);
      const assignment = professor.id && subject.id && existingAssignments.find((row) => row.professor_id === professor.id && row.subject_id === subject.id && row.group_code === entry.clave_grupo && row.semester === data.semestre.codigo);
      assignments.push({ professor, subject, source: entry, existing: assignment });
    }
  }
  const wantedIds = new Set(assignments.filter((item) => item.existing).map((item) => item.existing.id));
  const inactivated = existingAssignments.filter((row) => row.semester === data.semestre.codigo && row.active && !wantedIds.has(row.id));
  const summary = {
    semester: data.semestre.codigo,
    professorsReused: professors.filter((row) => row.existing).length,
    professorsCreated: professors.filter((row) => !row.existing).map((row) => ({ employeeNumber: row.source.numero_empleado, name: row.source.nombre_fuente, email: row.source.email || null })),
    subjectsReused: [...subjects.values()].filter((row) => row.existing).length,
    subjectsCreated: [...subjects.values()].filter((row) => !row.existing).map((row) => row.name),
    assignmentsReused: assignments.filter((row) => row.existing).length,
    assignmentsCreated: assignments.filter((row) => !row.existing).length,
    assignmentsInactivated: inactivated.map((row) => row.id),
    activeAssignments: assignments.length,
    legacyNameMatches: nameMatches,
    excludedFromSource: data.totales.asignaciones_excluidas
  };
  return { professors, subjects, assignments, summary };
}

async function resolveDriveDestination(data) {
  const drive = await storage.getDriveClient();
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error('Falta la raíz histórica de Drive.');
  const folder = await storage.findDriveFolder(drive, rootId, data.carpetas.carpeta_semestre_nombre);
  if (!folder) throw new Error('No se encontró la subcarpeta del semestre dentro de la raíz configurada.');
  const info = await drive.files.get({ fileId: folder.id, fields: 'id,name,parents,mimeType,trashed,capabilities(canAddChildren)', supportsAllDrives: true });
  if (info.data.trashed || !info.data.parents.includes(rootId) || !info.data.capabilities.canAddChildren) throw new Error('No se puede escribir en el destino del semestre.');
  return info.data;
}

async function readPlan(data, connection = db) {
  const [professors] = await connection.query('SELECT id,employee_number,full_name,active FROM professors');
  const [subjects] = await connection.query('SELECT id,name,credits FROM subjects');
  const [assignments] = await connection.query('SELECT * FROM teaching_assignments');
  return buildPlan(data, professors, subjects, assignments);
}

async function applyImport(data, folder) {
  await migrate();
  const connection = await db.getConnection();
  const lock = 'gd-semester-import';
  try {
    const [[locked]] = await connection.execute('SELECT GET_LOCK(?,30) AS acquired', [lock]);
    if (!locked.acquired) throw new Error('Otra importación está en curso.');
    await connection.beginTransaction();
    const plan = await readPlan(data, connection);
    await connection.execute(`INSERT IGNORE INTO academic_semesters (code,label,drive_folder_id,legacy_layout)
      SELECT DISTINCT semester,semester,?,1 FROM teaching_assignments WHERE semester <> ?`, [process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID, data.semestre.codigo]);
    await connection.execute('UPDATE academic_semesters SET is_current = 0 WHERE is_current = 1 AND code <> ?', [data.semestre.codigo]);
    const [previous] = await connection.execute('SELECT * FROM academic_semesters WHERE code = ?', [data.semestre.codigo]);
    if (previous[0] && previous[0].drive_folder_id && previous[0].drive_folder_id !== folder.id) throw new Error('El semestre ya tiene otro destino de Drive. Se requiere conciliación antes de cambiarlo.');
    await connection.execute(`INSERT INTO academic_semesters (code,label,is_current,drive_folder_id,legacy_layout)
      VALUES (?,?,1,?,0) ON DUPLICATE KEY UPDATE label=VALUES(label),is_current=1,drive_folder_id=VALUES(drive_folder_id),legacy_layout=0`, [data.semestre.codigo, data.semestre.nombre, folder.id]);
    for (const professor of plan.professors) {
      if (!professor.existing) {
        const passwordHash = await hashPassword(professor.source.numero_empleado);
        const [result] = await connection.execute(`INSERT INTO professors (employee_number,full_name,email,department,active,password_hash,must_change_password)
          VALUES (?,?,?,NULL,1,?,1)`, [professor.source.numero_empleado, normalizeCatalogName(professor.source.nombre_fuente), professor.source.email || null, passwordHash]);
        professor.id = result.insertId;
      } else if (!professor.existing.employee_number) {
        await connection.execute('UPDATE professors SET employee_number = ? WHERE id = ?', [professor.source.numero_empleado, professor.id]);
      }
    }
    for (const subject of plan.subjects.values()) {
      if (!subject.existing) {
        const [result] = await connection.execute('INSERT INTO subjects (name,subject_code,credits) VALUES (?,NULL,?)', [subject.name, subject.credits]);
        subject.id = result.insertId;
      }
    }
    if (plan.summary.assignmentsInactivated.length) {
      await connection.query('UPDATE teaching_assignments SET active = 0 WHERE semester = ? AND id IN (?)', [data.semestre.codigo, plan.summary.assignmentsInactivated]);
    }
    for (const assignment of plan.assignments) {
      const { professor, subject, source } = assignment;
      await connection.execute(`INSERT INTO teaching_assignments
        (professor_id,subject_id,group_code,semester,career,active,credits,source_name,source_page,source_document)
        VALUES (?,?,?,?,NULL,1,?,?,?,?) ON DUPLICATE KEY UPDATE active=1,credits=VALUES(credits),
        source_name=VALUES(source_name),source_page=VALUES(source_page),source_document=VALUES(source_document)`,
      [professor.id, subject.id, source.clave_grupo, data.semestre.codigo, source.creditos, source.nombre_fuente, source.pagina_pdf, data.fuente]);
    }
    const [active] = await connection.execute('SELECT id FROM teaching_assignments WHERE semester = ? AND active = 1', [data.semestre.codigo]);
    if (active.length !== data.totales.asignaciones_a_cargar) throw new Error('No coincide el conjunto activo de asignaciones.');
    await connection.commit();
    return plan.summary;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.execute('SELECT RELEASE_LOCK(?)', [lock]).catch(() => {});
    connection.release();
  }
}

async function provisionFolders(data) {
  const folders = [];
  for (const source of data.profesores) {
    const [[professor]] = await db.execute('SELECT id,employee_number,full_name FROM professors WHERE employee_number = ?', [source.numero_empleado]);
    const folderId = await storage.ensureProfessorFolder({ professor_id: professor.id, employee_number: professor.employee_number, professor_name: professor.full_name, semester: data.semestre.codigo });
    folders.push({ employeeNumber: professor.employee_number, folderId });
  }
  return folders;
}

async function main() {
  const sourceArg = process.argv.find((arg) => arg.startsWith('--data='));
  const data = JSON.parse(fs.readFileSync(sourceArg ? sourceArg.slice(7) : path.join(__dirname, '../data/semester-2026-3.json'), 'utf8'));
  validateData(data);
  const folder = await resolveDriveDestination(data);
  const apply = process.argv.includes('--apply');
  const summary = apply ? await applyImport(data, folder) : (await readPlan(data)).summary;
  const result = { mode: apply ? 'applied' : 'dry-run', ...summary, driveDestination: folder };
  if (apply && !process.argv.includes('--skip-folders')) result.professorFolders = await provisionFolders(data);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.end());
module.exports = { validateData, buildPlan, readPlan, applyImport, provisionFolders, resolveDriveDestination };
