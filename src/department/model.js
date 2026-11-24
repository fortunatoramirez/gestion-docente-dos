const db = require('../config/database');
const demo = require('../models/demoStore');
const { withDemoFallback } = require('../utils/dbFallback');
const { admissible } = require('../utils/semesterAccess');
const Semester = require('../models/semesterModel');
const { automaticRecords, applicability, criteria } = require('./rubric');

const demoFiles = [];
const demoEvaluations = [];
const demoReviews = [];
const dossierSelect = `SELECT d.*, p.full_name, p.employee_number
  FROM department_evaluations d JOIN professors p ON p.id = d.professor_id`;

function demoDossier(row) {
  if (!row) return null;
  const { full_name, employee_number } = demo.findProfessorById(row.professor_id);
  return { ...row, full_name, employee_number };
}

async function list(semester) {
  return withDemoFallback(async () => {
    const [rows] = await db.execute(dossierSelect + ' WHERE d.semester = ? ORDER BY p.full_name', [semester]);
    return rows;
  }, () => demoEvaluations.filter((row) => row.semester === semester).map(demoDossier)
    .sort((a, b) => a.full_name.localeCompare(b.full_name)));
}

async function find(id) {
  return withDemoFallback(async () => {
    const [rows] = await db.execute(dossierSelect + ' WHERE d.id = ?', [id]);
    return rows[0];
  }, () => demoDossier(demoEvaluations.find((row) => row.id === id)));
}

async function findOwn(professorId, semester) {
  return withDemoFallback(async () => {
    const [rows] = await db.execute('SELECT id FROM department_evaluations WHERE professor_id = ? AND semester = ?', [professorId, semester]);
    return rows[0];
  }, () => demoEvaluations.find((row) => row.professor_id === professorId && row.semester === semester));
}

function changed() {
  const error = new Error('El semestre o la aplicabilidad cambió. Vuelve a abrir el expediente.');
  error.code = 'DEPARTMENT_CHANGED';
  return error;
}

async function enroll(professorId, semester) {
  return withDemoFallback(async () => {
    const [result] = await db.execute(`INSERT INTO department_evaluations (professor_id, semester)
      SELECT ?, code FROM academic_semesters WHERE code = ? AND is_current = 1
      ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`, [professorId, semester]);
    if (!result.insertId) throw changed();
    return result.insertId;
  }, async () => {
    if ((await Semester.current()).code !== semester) throw changed();
    let row = demoEvaluations.find((r) => r.professor_id === professorId && r.semester === semester);
    if (!row) {
      row = { id: demoEvaluations.length + 1, professor_id: professorId, semester, tutoria: null, investigacion: null, vinculacion: null };
      demoEvaluations.push(row);
    }
    return row.id;
  });
}

// Check the active semester under the same lock as the change. An upload can take
// several minutes on Drive, during which the administrator may switch semesters.
async function editCurrent(id, write, demoWrite) {
  return withDemoFallback(async () => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(`SELECT d.* FROM department_evaluations d
        JOIN academic_semesters s ON s.code = d.semester WHERE d.id = ? AND s.is_current = 1 FOR UPDATE`, [id]);
      if (!rows.length) throw changed();
      await write(conn, rows[0]);
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }, async () => {
    const semester = (await Semester.current()).code;
    const item = demoEvaluations.find((d) => d.id === id && d.semester === semester);
    if (!item) throw changed();
    return demoWrite(item);
  });
}

async function setScope(id, scope) {
  return editCurrent(id, (conn) => conn.execute(`UPDATE department_evaluations SET tutoria = :tutoria,
    investigacion = :investigacion, vinculacion = :vinculacion WHERE id = :id`, { ...scope, id }),
  (item) => Object.assign(item, scope));
}

async function saveReview(row) {
  const requireApplicable = (item) => {
    const c = criteria.find((criterion) => criterion.id === row.criterion);
    if (!c || applicability(item, c.area) !== 'Aplica') throw changed();
  };
  return editCurrent(row.evaluation_id, async (conn, item) => {
    requireApplicable(item);
    await conn.execute(`INSERT INTO department_reviews (evaluation_id, criterion, score, note, reviewer_id)
      VALUES (:evaluation_id, :criterion, :score, :note, :reviewer_id)
      ON DUPLICATE KEY UPDATE score = VALUES(score), note = VALUES(note), reviewer_id = VALUES(reviewer_id)`, row);
  }, (item) => {
    requireApplicable(item);
    const existing = demoReviews.find((r) => r.evaluation_id === row.evaluation_id && r.criterion === row.criterion);
    if (existing) Object.assign(existing, row);
    else demoReviews.push(row);
  });
}

async function saveFile(row) {
  return editCurrent(row.evaluation_id, (conn) => conn.execute(`INSERT INTO department_evidence
    (evaluation_id, criterion, source, contributor_id, upload_token, title, original_name, stored_name, mime_type, size_bytes, path, storage_provider, storage_key)
    VALUES (:evaluation_id, :criterion, :source, :contributor_id, :upload_token, :title, :original_name, :stored_name, :mime_type, :size_bytes, :path, :storage_provider, :storage_key)`, row),
  () => {
    if (demoFiles.some((f) => f.evaluation_id === row.evaluation_id && f.contributor_id === row.contributor_id && f.upload_token === row.upload_token)) {
      throw Object.assign(new Error('El comprobante ya fue registrado.'), { code: 'ER_DUP_ENTRY' });
    }
    demoFiles.push({ ...row, id: demoFiles.length + 1, created_at: new Date() });
  });
}

async function findFile(evaluationId, id) {
  return withDemoFallback(async () => {
    const [rows] = await db.execute('SELECT * FROM department_evidence WHERE evaluation_id = ? AND id = ?', [evaluationId, id]);
    return rows[0];
  }, () => demoFiles.find((f) => f.id === id && f.evaluation_id === evaluationId));
}

// Para el consolidado se leen los datos de todo el semestre en tres consultas.
// Todas las uniones parten de un expediente, incluso cuando un docente no tiene carga frente a grupo.
async function evidenceData(semester, { id = null, current = true, full = true } = {}) {
  const params = id === null ? [semester] : [semester, id];
  const filter = ' WHERE d.semester = ?' + (id === null ? '' : ' AND d.id = ?');
  const matches = (r) => demoEvaluations.some((d) => d.id === r.evaluation_id && d.semester === semester && (id === null || d.id === id));
  const manual = await withDemoFallback(async () => {
    const [rows] = await db.execute(`SELECT f.id, f.evaluation_id, f.criterion, f.source, f.title, f.original_name, f.created_at,
      p.full_name AS contributor FROM department_evaluations d JOIN department_evidence f ON f.evaluation_id = d.id
      JOIN professors p ON p.id = f.contributor_id` + filter + ' ORDER BY f.id', params);
    return rows;
  }, () => demoFiles.filter(matches).map((f) => ({ ...f, contributor: demo.findProfessorById(f.contributor_id).full_name })));
  if (!full) return { manual, automatic: [], reviews: [] };

  const reviews = await withDemoFallback(async () => {
    const [rows] = await db.execute(`SELECT r.* FROM department_evaluations d JOIN department_reviews r
      ON r.evaluation_id = d.id` + filter, params);
    return rows;
  }, () => demoReviews.filter(matches));
  const rows = await withDemoFallback(async () => {
    const [items] = await db.execute(`SELECT d.id AS evaluation_id, d.semester, p.employee_number, a.id AS assignment_id,
      a.group_code, s.name AS subject_name, r.id AS report_id, r.period, r.submitted_at,
      e.id AS file_id, e.category, e.original_name, e.created_at AS file_date
      FROM department_evaluations d JOIN professors p ON p.id = d.professor_id
      JOIN teaching_assignments a ON a.professor_id = d.professor_id AND a.semester = d.semester
      JOIN subjects s ON s.id = a.subject_id JOIN reports r ON r.assignment_id = a.id AND r.status = 'submitted'
      LEFT JOIN evidence_files e ON e.report_id = r.id` + filter + (current ? ' AND a.active = 1' : '') +
      ' ORDER BY d.id, s.name, a.group_code, r.period, e.id', params);
    return items.filter((a) => admissible(a, a.employee_number));
  }, () => {
    const items = [];
    for (const d of demoEvaluations.filter((r) => r.semester === semester && (id === null || r.id === id))) {
      const { employee_number } = demo.findProfessorById(d.professor_id);
      for (const a of demo.listAssignmentsAdmin().filter((a) => a.employee_number === employee_number && a.semester === semester
        && (!current || a.active) && admissible(a, employee_number))) {
        for (const period of [1, 2, 3]) {
          const r = demo.findReportByAssignmentAndPeriod(a.id, period);
          if (r?.status !== 'submitted') continue;
          const files = demo.listEvidenceByReportId(r.id);
          for (const f of files.length ? files : [null]) {
            items.push({ ...a, evaluation_id: d.id, assignment_id: a.id, report_id: r.id, period,
              submitted_at: r.submitted_at, file_id: f?.id, category: f?.category, original_name: f?.original_name, file_date: f?.created_at });
          }
        }
      }
    }
    return items;
  });
  return { manual, automatic: automaticRecords(rows), reviews };
}

module.exports = { list, find, findOwn, enroll, setScope, saveReview, saveFile, findFile, evidenceData };
