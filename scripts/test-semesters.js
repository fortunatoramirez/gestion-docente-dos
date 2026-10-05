require('dotenv').config();
const assert = require('node:assert/strict');
const crypto = require('crypto');
const signature = require('cookie-signature');
const db = require('../src/config/database');
const data = require('../data/semester-2026-3.json');
const importer = require('./import-semester');
const Assignment = require('../src/models/assignmentModel');
const Evidence = require('../src/models/evidenceModel');
const storage = require('../src/services/evidenceStorage');
const { normalizeCatalogName } = require('../src/utils/text');

const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function baseline() {
  const [professors] = await db.query('SELECT * FROM professors WHERE id <= 40 ORDER BY id');
  const [subjects] = await db.query('SELECT * FROM subjects WHERE id <= 116 ORDER BY id');
  const [assignments] = await db.query("SELECT * FROM teaching_assignments WHERE semester <> '2026-3' ORDER BY id");
  const [reports] = await db.query("SELECT r.* FROM reports r JOIN teaching_assignments a ON a.id = r.assignment_id WHERE a.semester <> '2026-3' ORDER BY r.id");
  const [evidence] = await db.query("SELECT e.* FROM evidence_files e JOIN reports r ON r.id=e.report_id JOIN teaching_assignments a ON a.id=r.assignment_id WHERE a.semester <> '2026-3' ORDER BY e.id");
  return hash({ professors, subjects, assignments, reports, evidence });
}

async function sessionCookie(employeeNumber) {
  const [[professor]] = await db.execute('SELECT * FROM professors WHERE employee_number = ?', [employeeNumber]);
  assert(professor);
  delete professor.password_hash;
  const id = crypto.randomBytes(24).toString('hex');
  const cookie = { originalMaxAge: 3600000, expires: new Date(Date.now()+3600000), secure: false, httpOnly: true, path: '/', sameSite: 'lax' };
  await db.execute('INSERT INTO sessions (session_id,expires,data) VALUES (?,?,?)', [id, Math.floor(Date.now()/1000)+3600, JSON.stringify({ cookie, professor })]);
  return `gestion_docente_sid=${encodeURIComponent(`s:${signature.sign(id, process.env.APP_SESSION_SECRET)}`)}`;
}

async function main() {
  assert.equal(process.env.DB_NAME, 'gestion_docente_2026_3_test', 'Run only against the isolated test database');
  importer.validateData(data);
  assert.equal(normalizeCatalogName(' diseño   y SEÑALES '), 'DISEÑO Y SEÑALES');
  const folder = { id: '104VEyo9nczlUVGuQLFhhSDCtQZEL2NNY' };
  await require('./migrate-semesters')();
  const before = await baseline();
  const first = await importer.applyImport(data, folder);
  assert.equal(first.activeAssignments, 82);
  assert.equal(first.professorsReused, 33);
  assert.equal(first.professorsCreated.length, 2);
  assert.equal(first.subjectsReused, 51);
  assert.equal(first.subjectsCreated.length, 9);
  const [newEmails] = await db.query("SELECT employee_number,email FROM professors WHERE employee_number IN ('2956','2957') ORDER BY employee_number");
  assert.deepEqual(newEmails.map((row) => row.email), ['fidel.ortega193@tectijuana.edu.mx','jesus.marquezc201@tectijuana.edu.mx']);
  assert.equal(await baseline(), before, 'Existing accounts, catalog and history must be unchanged');
  const second = await importer.applyImport(data, folder);
  assert.equal(second.assignmentsCreated, 0);
  assert.equal(second.assignmentsReused, 82);
  assert.equal(second.professorsCreated.length, 0);
  assert.equal(second.subjectsCreated.length, 0);
  const [[celia]] = await db.query("SELECT COUNT(*) AS count FROM professors WHERE employee_number = '1007'");
  assert.equal(celia.count, 1);
  const [credits] = await db.query("SELECT a.group_code,a.credits FROM teaching_assignments a JOIN subjects s ON s.id=a.subject_id WHERE a.semester='2026-3' AND s.name='MEDICIONES ELECTRICAS'");
  assert(credits.every((row) => row.credits === (row.group_code.startsWith('BM') ? 3 : 5)));
  const [[teacher]] = await db.query("SELECT id FROM professors WHERE employee_number='2835'");
  const [old] = await db.query("SELECT * FROM teaching_assignments WHERE professor_id=? AND semester <> '2026-3' LIMIT 1", [teacher.id]);
  const own = (await Assignment.listForProfessor(teacher.id))[0];
  assert.equal(own.semester, '2026-3');
  assert.equal(await Assignment.findByIdForProfessor(old[0].id, teacher.id), null);
  const [[emptyTeacher]] = await db.query("SELECT id FROM professors WHERE employee_number='2861'");
  assert.deepEqual(await Assignment.listForProfessor(emptyTeacher.id), []);
  const [[other]] = await db.query("SELECT id FROM teaching_assignments WHERE semester='2026-3' AND professor_id <> ? LIMIT 1", [teacher.id]);
  const [[oldFile]] = await db.query('SELECT e.id FROM evidence_files e JOIN reports r ON r.id=e.report_id WHERE r.assignment_id=? LIMIT 1', [old[0].id]);
  assert.equal(await Evidence.findByIdForProfessor(oldFile.id, teacher.id), null);
  storage.downloadEvidence = (file, res) => res.send('authorized evidence');
  storage.removeEvidence = async () => { throw new Error('Test guard: must not remove historical files'); };
  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}/gestion-docente`;
  await db.query('SELECT 1 FROM sessions LIMIT 1');
  const teacherCookie = await sessionCookie('2835');
  const adminCookie = await sessionCookie('2289');
  const request = (route, cookie, options = {}) => fetch(`${origin}${route}`, { ...options, headers: { ...options.headers, Cookie: cookie }, redirect: 'manual' });
  try {
    assert.equal((await request(`/reportes/materias/${own.id}/parcial/1`, teacherCookie)).status, 200);
    for (const id of [old[0].id, other.id]) {
      assert.equal((await request(`/reportes/materias/${id}/parcial/1`, teacherCookie)).status, 404);
      assert.equal((await request(`/reportes/materias/${id}/parcial/1`, teacherCookie, { method: 'POST' })).status, 404);
    }
    assert.equal((await request(`/reportes/evidencias/${oldFile.id}/descargar`, teacherCookie)).status, 404);
    assert.equal((await request(`/reportes/evidencias/${oldFile.id}/eliminar`, teacherCookie, { method: 'POST' })).status, 404);
    assert.equal((await request('/admin', teacherCookie)).status, 403);
    const currentAdmin = await request('/admin?semestre=2026-3', adminCookie);
    assert.equal(currentAdmin.status, 200);
    assert((await currentAdmin.text()).includes('2026-3 (actual)'));
    const historicalAdmin = await request('/admin?semestre=Ene-Jun%202026', adminCookie);
    assert.equal(historicalAdmin.status, 200);
    assert((await historicalAdmin.text()).includes('Ene-Jun 2026'));
    assert.equal((await request(`/admin/asignaciones/${old[0].id}/reportes/1`, adminCookie)).status, 200);
    assert.equal((await request(`/admin/evidencias/${oldFile.id}/descargar`, adminCookie)).status, 200);
    const noSubjects = await request('/dashboard', await sessionCookie('2861'));
    assert((await noSubjects.text()).includes('No tienes materias asignadas para el semestre 2026-3'));
    const form = new FormData();
    for (const [key,value] of Object.entries({ enrolled_students: '10', approved_students: '10', absent_students: '0', action: 'draft', units_exam_0: 'I' })) form.set(key,value);
    form.set('evidence_exam', new Blob(['semester test evidence'], { type: 'text/plain' }), 'test.txt');
    assert.equal((await request(`/reportes/materias/${own.id}/parcial/1`, teacherCookie, { method: 'POST', body: form })).status, 302);
    const [[newFile]] = await db.query('SELECT e.* FROM evidence_files e JOIN reports r ON r.id=e.report_id WHERE r.assignment_id=?', [own.id]);
    assert(newFile.path.includes('/2026-3/'));
    assert(newFile.path.includes('/ie7e/evidencias/'));
    const newLogin = await fetch(`${origin}/login`, { method:'POST', body:new URLSearchParams({ employee_number:'2957', password:'2957' }), redirect:'manual' });
    assert.equal(newLogin.status, 302);
    assert.equal(newLogin.headers.get('location'), '/gestion-docente/perfil');
    const initialCookie = newLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/dashboard', initialCookie)).headers.get('location'), '/gestion-docente/perfil');
    const updated = await request('/perfil/password', initialCookie, { method:'POST', body:new URLSearchParams({ current_password:'2957', new_password:'Test-Semester-2026', confirm_password:'Test-Semester-2026' }) });
    assert.equal(updated.status, 302);
    assert.equal(updated.headers.get('location'), '/gestion-docente/perfil?actualizada=1');
    await updated.text();
    const afterPassword = await request('/dashboard', initialCookie);
    assert.equal(afterPassword.status, 200, `Password redirect: ${afterPassword.headers.get('location')}`);
    const [[newProfessor]] = await db.query("SELECT must_change_password FROM professors WHERE employee_number='2957'");
    assert.equal(newProfessor.must_change_password, 0);
    await db.execute("INSERT INTO teaching_assignments (professor_id,subject_id,group_code,semester,active) VALUES (?,?,'MIM-TEST','2026-3',1)", [teacher.id, (await Assignment.findByIdAdmin(own.id)).subject_id]);
    const [[excluded]] = await db.query("SELECT id FROM teaching_assignments WHERE group_code='MIM-TEST'");
    assert.equal((await request(`/reportes/materias/${excluded.id}/parcial/1`, teacherCookie)).status, 404);
    assert.equal((await request(`/reportes/materias/${excluded.id}/parcial/1`, teacherCookie, { method:'POST' })).status, 404);
    const reconciliation = await importer.applyImport(data, folder);
    assert(reconciliation.assignmentsInactivated.includes(excluded.id));
    await db.execute('UPDATE teaching_assignments SET active=0 WHERE id=?', [own.id]);
    assert.equal((await request(`/reportes/materias/${own.id}/parcial/1`, teacherCookie)).status, 404);
    assert.equal((await request(`/reportes/evidencias/${newFile.id}/descargar`, teacherCookie)).status, 404);
    assert.equal(await baseline(), before, 'Historical data must remain unchanged after HTTP tests');
    console.log('PASS: exact import, repeat import, historical preservation, credits, teacher/admin access, file upload, first-login password change, excluded/inactive assignments');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => { console.error(error); process.exitCode=1; }).finally(async () => { await db.end(); process.exit(process.exitCode || 0); });
