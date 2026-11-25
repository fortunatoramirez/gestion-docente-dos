const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('expediente departamental por HTTP', async (t) => {
  const sql = process.env.DEPARTMENT_TEST_SQL === '1';
  const uploads = await fs.mkdtemp(path.join(os.tmpdir(), 'gd-evaluacion-'));
  const database = 'gd_dept_test_' + crypto.randomBytes(8).toString('hex');
  Object.assign(process.env, { NODE_ENV: 'test', DB_NAME: database, DB_DEMO_FALLBACK: sql ? 'false' : 'true',
    SESSION_STORE: 'memory', APP_BASE_PATH: '/prueba', ACTIVE_SEMESTER: '2026-3', STORAGE_DRIVER: 'local',
    ADMIN_EMPLOYEE_NUMBERS: 'TEST-A', DEPT_TUTORIAS_EMPLOYEES: 'TEST-T', DEPT_INVESTIGACION_EMPLOYEES: '',
    DEPT_VINCULACION_EMPLOYEES: '', UPLOAD_DIR: uploads });
  if (!sql) Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '1' });
  let connection, server, pool;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (pool) await pool.end();
    if (connection) {
      await connection.query('DROP DATABASE IF EXISTS ' + database);
      await connection.end();
    }
    await fs.rm(uploads, { recursive: true, force: true });
  });
  if (sql) {
    const mysql = require('mysql2/promise');
    connection = await mysql.createConnection({ ...require('../src/config/mysql'), database: undefined, multipleStatements: true });
    await connection.query('CREATE DATABASE ' + database + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    await connection.query('USE ' + database);
    const schema = await fs.readFile(path.join(__dirname, '../db/schema.sql'), 'utf8');
    await connection.query(schema.slice(schema.indexOf('CREATE TABLE')));
    await connection.execute("INSERT INTO academic_semesters(code,label,is_current) VALUES ('2026-3','Actual',1),('2027-1','Siguiente',0)");
    await connection.query('ALTER TABLE department_evaluations DROP COLUMN enabled');
    const migrate = require('./migrate-department');
    await migrate();
    await migrate();
  }
  pool = require('../src/config/database');
  const app = require('../src/app');
  const Professor = require('../src/models/professorModel');
  const Subject = require('../src/models/subjectModel');
  const Assignment = require('../src/models/assignmentModel');
  const { criteria } = require('../src/department/rubric');
  assert.equal(criteria.length, 15);
  assert(criteria.every((c, i) => c.id === i + 1 && c.levels.length === 6));
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const prefix = '/prueba';
  const origin = 'http://127.0.0.1:' + server.address().port;
  function request(route, cookie, body) {
    return fetch(origin + prefix + route, {
      redirect: 'manual', headers: cookie ? { Cookie: cookie } : {},
      method: body ? 'POST' : 'GET', body: body && !(body instanceof FormData) ? new URLSearchParams(body) : body
    });
  }
  async function account(employee, name) {
    const id = await Professor.create({ employee_number: employee, full_name: name, department: 'Prueba',
      email: null, active: 1, temporary_password: 'temporal-de-prueba' });
    const login = await request('/login', null, { employee_number: employee, password: 'temporal-de-prueba' });
    assert.equal(login.status, 302);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/evaluacion', cookie)).headers.get('location'), prefix + '/perfil');
    const changed = await request('/perfil/password', cookie, { current_password: 'temporal-de-prueba',
      new_password: 'nueva-de-prueba', confirm_password: 'nueva-de-prueba' });
    assert.equal(changed.status, 302);
    return { cookie, id };
  }
  const admin = await account('TEST-A', 'Jefatura de prueba');
  const teacher = await account('TEST-P', 'Docente de prueba');
  const office = await account('TEST-T', 'Tutorías de prueba');
  const other = await account('TEST-O', 'Otro docente');
  const head = await account('TEST-H', 'Jefe de departamento de prueba');
  const registry = '/evaluacion/departamento';
  const semester = '2026-3';
  const enroll = { professor_id: teacher.id, semester };
  let dossier, practiceLink, manualLink, officeLink;
  const manualTitle = 'Guía complementaria';
  function fileForm(source, title, token = crypto.randomUUID()) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ source, title, token })) form.set(key, value);
    form.set('file', new Blob(['archivo de prueba'], { type: 'text/plain' }), 'constancia.txt');
    return form;
  }
  function section(html, criterion) {
    const marker = 'id="criterio-' + criterion + '"';
    const start = html.indexOf(marker);
    assert(start >= 0, marker);
    const end = html.indexOf('class="dept-criterion"', start);
    return html.slice(start, end < 0 ? undefined : end);
  }
  function link(html, title) {
    const match = [...html.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)].find((m) => m[2] === title);
    assert(match, title);
    return match[1].slice(prefix.length);
  }

  await t.test('alta de tiempo completo, sesiones y aislamiento entre docentes', async () => {
    assert.equal((await request('/evaluacion')).status, 302);
    assert.match(await (await request('/evaluacion', teacher.cookie)).text(), /Sin expediente/);
    assert.equal((await request(registry, other.cookie)).status, 403);
    assert.equal((await request(registry + '/alta', office.cookie, enroll)).status, 403);
    const first = await request(registry + '/alta', admin.cookie, enroll);
    assert.equal(first.status, 302);
    dossier = first.headers.get('location').slice(prefix.length);
    assert.equal((await request(registry + '/alta', admin.cookie, enroll)).headers.get('location'), first.headers.get('location'));
    assert.equal((await request('/evaluacion', teacher.cookie)).headers.get('location'), prefix + dossier);
    assert.equal((await request(dossier, other.cookie)).status, 404);
    assert.match(await (await request('/perfil', teacher.cookie)).text(), /Evaluación departamental/);
  });

  await t.test('fuentes de los parciales, propiedad, borradores y descargas', async () => {
    const subject = await Subject.create({ name: 'Asignatura de prueba', subject_code: 'TST', credits: 4 });
    async function assignment(professor, group) {
      return Assignment.create({ professor_id: professor.id, subject_id: subject, group_code: group, career: null, semester, active: 1 });
    }
    const course = await assignment(teacher, 'BT1');
    const foreign = await assignment(other, 'BT2');
    async function partial(id, user, period, action, category, name) {
      const form = new FormData();
      for (const [key, value] of Object.entries({ enrolled_students: '5', approved_students: '5',
        absent_students: '0', action, ['units_' + category + '_0']: 'I' })) form.set(key, value);
      form.set('evidence_' + category, new Blob(['parcial'], { type: 'text/plain' }), name);
      const answer = await request('/reportes/materias/' + id + '/parcial/' + period, user.cookie, form);
      assert.equal(answer.status, 302);
    }
    await partial(course, teacher, 1, 'submit', 'practice', 'practica.txt');
    await partial(course, teacher, 2, 'draft', 'exercise', 'borrador.txt');
    await partial(course, teacher, 3, 'submit', 'exam', 'examen.txt');
    await partial(course, teacher, 1, 'submit', 'research', 'trabajo-alumnado.txt');
    await partial(foreign, other, 1, 'submit', 'research', 'de-otro.txt');
    const html = await (await request(dossier, teacher.cookie)).text();
    assert.match(section(html, 2), /Reporte enviado/);
    assert.match(section(html, 2), /examen.txt/);
    assert.match(section(html, 3), /practica.txt/);
    assert.match(section(html, 3), /trabajo-alumnado.txt/);
    assert.doesNotMatch(section(html, 7), /trabajo-alumnado.txt/);
    assert.doesNotMatch(html, /borrador.txt|de-otro.txt/);
    practiceLink = link(html, 'practica.txt');
    assert.equal(await (await request(practiceLink, teacher.cookie)).text(), 'parcial');
    const adminView = await (await request(dossier, admin.cookie)).text();
    assert.equal(await (await request(link(adminView, 'practica.txt'), admin.cookie)).text(), 'parcial');
  });

  await t.test('comprobantes complementarios, reintento y aportaciones delimitadas por oficina', async () => {
    const route = (id) => dossier + '/criterios/' + id + '/evidencias';
    const token = crypto.randomUUID();
    const repeat = () => request(route(3), teacher.cookie, fileForm('docente', manualTitle, token));
    const results = await Promise.all([repeat(), repeat()]);
    assert(results.every((r) => r.status === 302));
    const storedFiles = (await fs.readdir(uploads, { recursive: true })).filter((name) => /criterio_3_.*\.txt$/.test(name));
    assert.equal(storedFiles.length, 1);
    let html = await (await request(dossier, teacher.cookie)).text();
    assert.equal(html.split(manualTitle).length - 1, 1);
    assert.match(section(html, 3), /practica.txt/);
    manualLink = link(html, manualTitle);
    assert.equal(await (await request(manualLink, teacher.cookie)).text(), 'archivo de prueba');
    assert.equal((await request(manualLink, other.cookie)).status, 404);
    assert.equal((await request(manualLink, office.cookie)).status, 404);
    assert.equal((await request(route(5), teacher.cookie, fileForm('tutorias', 'Origen ajeno'))).status, 403);
    assert.equal((await request(route(1), office.cookie, fileForm('tutorias', 'Fuera de rubro'))).status, 403);
    assert.equal((await request(route(5), office.cookie, fileForm('tutorias', 'Asistencia tutorial'))).status, 302);
    assert.equal((await request(route(5), teacher.cookie, fileForm('docente', 'Anexo personal'))).status, 302);
    html = await (await request(dossier, office.cookie)).text();
    assert.doesNotMatch(html, /Anexo personal|practica.txt|id="criterio-1"/);
    officeLink = link(html, 'Asistencia tutorial');
    assert.equal(await (await request(officeLink, office.cookie)).text(), 'archivo de prueba');
    assert.equal(await (await request(officeLink, teacher.cookie)).text(), 'archivo de prueba');
    assert.equal((await request(dossier + '/reporte', office.cookie)).status, 403);
    assert.deepEqual(await fs.readdir(path.join(uploads, 'tmp')), []);
  });

  await t.test('aplicabilidad, consulta sin calificaciones y concentrado CSV', async () => {
    const review = dossier + '/criterios/5/valorar';
    const scope = { tutoria: '1', investigacion: '', vinculacion: '0' };
    assert.equal((await request(review, admin.cookie, { score: '5' })).status, 403);
    assert.equal((await request(dossier + '/rubros', teacher.cookie, scope)).status, 403);
    assert.equal((await request(dossier + '/rubros', admin.cookie, scope)).status, 302);
    assert.equal((await request(review, office.cookie, { score: '5' })).status, 403);
    assert.equal((await request(review, admin.cookie, { score: '0' })).status, 403);
    const html = await (await request(dossier + '/reporte', teacher.cookie)).text();
    assert.match(html, /Por definir/);
    assert.match(html, /No aplica/);
    assert.doesNotMatch(html, /Por valorar|name="score"|Guardar valoración/);
    assert.match(html, /Asistencia tutorial/);
    assert.doesNotMatch(html, /type="file"/);
    await request(registry + '/alta', admin.cookie, { professor_id: other.id, semester });
    const url = registry + '/concentrado.csv?semestre=2026-3';
    assert.equal((await request(url, teacher.cookie)).status, 403);
    const response = await request(url, admin.cookie);
    assert.match(response.headers.get('content-type'), /text\/csv/);
    const csv = await response.text();
    assert.equal(csv.trim().split('\r\n').length, 31);
    const otherRows = csv.split('\r\n').filter((row) => row.includes('"TEST-O"'));
    assert.equal(otherRows.length, 15);
    assert.doesNotMatch(csv, /"Valoración"|"Nivel \(0/);
    assert.match(csv, /"No aplica"/);
  });

  await t.test('jefe independiente de administrador, acceso completo de consulta y actividad docente propia', async () => {
    const designate = (user, id) => request(registry + '/jefe', user.cookie, { professor_id: String(id) });
    assert.equal((await designate(teacher, head.id)).status, 403);
    assert.equal((await designate(admin, admin.id)).status, 422);
    assert.equal((await designate(admin, '99999999')).status, 422);
    assert.equal((await designate(admin, head.id)).status, 302);
    assert.equal((await request(registry, head.cookie)).status, 200);
    assert.equal((await request('/admin', head.cookie)).status, 403);
    assert.equal((await request('/evaluacion', head.cookie)).headers.get('location'), prefix + registry);
    const html = await (await request(dossier, head.cookie)).text();
    assert.equal((html.match(/class="dept-criterion"/g) || []).length, 15);
    assert.doesNotMatch(html, /name="score"|name="file"|Guardar aplicabilidad|href="\/prueba\/admin"/);
    assert.match(html, /dept-sidebar/);
    assert.equal(await (await request(practiceLink, head.cookie)).text(), 'parcial');
    assert.equal(await (await request(manualLink, head.cookie)).text(), 'archivo de prueba');
    assert.equal(await (await request(officeLink, head.cookie)).text(), 'archivo de prueba');
    const reportLink = [...html.matchAll(/href="([^"]+\/reportes\/\d+\/1)"/g)][0][1].slice(prefix.length);
    assert.equal((await request(reportLink, head.cookie)).status, 200);
    assert.equal((await request(reportLink, other.cookie)).status, 404);
    assert.equal((await request(reportLink.replace(/\/1$/, '/2'), head.cookie)).status, 404, 'Draft reports are not shared');
    const foreignCourse = (await Assignment.listForProfessor(other.id))[0];
    const foreignReport = await require('../src/models/reportModel').findByAssignmentAndPeriod(foreignCourse.id, 1);
    const foreignFile = (await require('../src/models/evidenceModel').listByReportId(foreignReport.id))[0];
    assert.equal((await request(practiceLink.replace(/\d+$/, String(foreignFile.id)), head.cookie)).status, 404, 'Files must belong to the selected report and dossier');
    assert.equal((await request(registry + '/alta', head.cookie, enroll)).status, 403);
    assert.equal((await request(dossier + '/rubros', head.cookie, { tutoria:'1', investigacion:'1', vinculacion:'1' })).status, 403);
    assert.equal((await request(dossier + '/criterios/3/evidencias', head.cookie, fileForm('docente', 'No autorizado'))).status, 403);
    const opened = await request(registry + '/alta', admin.cookie, { professor_id:head.id, semester });
    head.dossier = opened.headers.get('location').slice(prefix.length);
    assert.equal((await request('/evaluacion/mi-expediente', head.cookie)).headers.get('location'), prefix + head.dossier);
    assert.equal((await request(head.dossier + '/criterios/3/evidencias', head.cookie, fileForm('docente', 'Comprobante propio del jefe'))).status, 302);
    const subject = await Subject.create({ name:'Materia del jefe', subject_code:'JEF', credits:4 });
    const course = await Assignment.create({ professor_id:head.id, subject_id:subject, group_code:'BT3', career:null, semester, active:1 });
    const partial = await request('/reportes/materias/' + course + '/parcial/1', head.cookie, {
      enrolled_students:'5', approved_students:'5', absent_students:'0', action:'draft'
    });
    assert.equal(partial.status, 302);
    assert.match(await (await request('/dashboard', head.cookie)).text(), /Materia del jefe|MATERIA DEL JEFE/);
    const ownStatus = registry + '/expedientes/' + head.dossier.split('/').at(-1) + '/estado';
    assert.equal((await request(ownStatus, admin.cookie, { enabled:'0' })).status, 302);
    assert.equal((await request(head.dossier, head.cookie)).status, 404);
    assert.equal((await request(dossier, head.cookie)).status, 200, 'Head role is independent of own full-time enrollment');
    assert.equal((await request(ownStatus, admin.cookie, { enabled:'1' })).status, 302);
    assert.equal((await designate(admin, other.id)).status, 302);
    assert.equal((await request(registry, head.cookie)).status, 403, 'Replaced head loses access without signing out');
    assert.equal((await request(dossier, head.cookie)).status, 404);
    assert.equal((await request(head.dossier, head.cookie)).status, 200, 'Former head retains their own dossier');
    assert.equal((await request(dossier, other.cookie)).status, 200);
    assert.equal((await designate(admin, '')).status, 302);
    assert.equal((await request(registry, other.cookie)).status, 403);
    assert.equal((await designate(admin, head.id)).status, 302);
  });

  await t.test('deshabilitación reversible sin borrar actividades ni alterar la gestión docente', async () => {
    const model = require('../src/department/model');
    const id = Number(dossier.split('/').at(-1));
    const before = await model.evidenceData(semester, { id });
    const status = registry + '/expedientes/' + id + '/estado';
    assert.equal((await request(status, head.cookie, { enabled:'0' })).status, 403);
    assert.equal((await request(status, admin.cookie, { enabled:'7' })).status, 422);
    assert.equal((await request(status, admin.cookie, { enabled:'0' })).status, 302);
    if (sql) {
      await require('./migrate-department')();
      assert.equal((await model.getHead()).id, head.id, 'Repeated migration must preserve the selected head');
      assert.equal((await model.find(id)).enabled, 0, 'Repeated migration must not reactivate disabled dossiers');
    }
    assert.equal((await request(dossier, teacher.cookie)).status, 404);
    assert.equal((await request(manualLink, teacher.cookie)).status, 404);
    assert.equal((await request(practiceLink, head.cookie)).status, 404);
    assert.equal((await request(dossier, head.cookie)).status, 404);
    const headList = await (await request(registry, head.cookie)).text();
    assert(!headList.includes('href="' + prefix + dossier + '"'));
    assert.match(await (await request(registry, admin.cookie)).text(), /Profesores deshabilitados/);
    assert.match(await (await request('/evaluacion/mi-expediente', teacher.cookie)).text(), /Sin expediente/);
    assert.match(await (await request('/dashboard', teacher.cookie)).text(), /Asignatura de prueba|ASIGNATURA DE PRUEBA/);
    const disabledView = await (await request(dossier, admin.cookie)).text();
    assert.match(disabledView, /Profesor deshabilitado/);
    assert.doesNotMatch(disabledView, /name="file"/);
    assert.deepEqual(await model.evidenceData(semester, { id }), before);
    assert.equal((await request(status, admin.cookie, { enabled:'1' })).status, 302);
    assert.equal(await (await request(manualLink, teacher.cookie)).text(), 'archivo de prueba');
    assert.deepEqual(await model.evidenceData(semester, { id }), before);
    assert.equal((await request(status, admin.cookie, { enabled:'0' })).status, 302);
    assert.equal((await request(registry + '/alta', admin.cookie, enroll)).headers.get('location'), prefix + dossier);
    assert.equal((await request(dossier, head.cookie)).status, 200);
    const storage = require('../src/services/evidenceStorage');
    const originalStore = storage.storeDepartmentFile;
    storage.storeDepartmentFile = async (...args) => {
      const stored = await originalStore(...args);
      await model.setEnabled(id, semester, 0);
      return stored;
    };
    try {
      const failed = await request(dossier + '/criterios/3/evidencias', teacher.cookie, fileForm('docente', 'Carga interrumpida'));
      assert.equal(failed.status, 409, 'Disabling during upload must prevent registration');
    } finally {
      storage.storeDepartmentFile = originalStore;
      await model.setEnabled(id, semester, 1);
    }
    assert.deepEqual(await model.evidenceData(semester, { id }), before);
    assert.deepEqual(await fs.readdir(path.join(uploads, 'tmp')), []);
  });

  await t.test('cambio de semestre y consulta histórica en modo lectura', async () => {
    if (sql) {
      await connection.execute("UPDATE academic_semesters SET is_current=0 WHERE code='2026-3'");
      await connection.execute("UPDATE academic_semesters SET is_current=1 WHERE code='2027-1'");
    } else {
      process.env.ACTIVE_SEMESTER = '2027-1';
    }
    assert.equal((await request(dossier, teacher.cookie)).status, 404);
    assert.equal((await request(manualLink, teacher.cookie)).status, 404);
    assert.equal((await request(officeLink, office.cookie)).status, 404);
    assert.equal((await request(practiceLink, teacher.cookie)).status, 404);
    assert.equal((await request(dossier, admin.cookie)).status, 200);
    assert.equal((await request(dossier, head.cookie)).status, 200);
    assert.equal((await request(registry + '?semestre=2026-3', head.cookie)).status, 200);
    assert.equal((await request(dossier + '/reporte', admin.cookie)).status, 200);
    assert.equal((await request(manualLink, admin.cookie)).status, 200);
    assert.equal((await request(dossier + '/criterios/3/valorar', admin.cookie, { score: '1' })).status, 403);
    assert.equal((await request(dossier + '/criterios/3/evidencias', admin.cookie, fileForm('docencia', 'Otro semestre'))).status, 403);
    assert.equal((await request(registry + '/alta', admin.cookie, enroll)).status, 422);
  });
});
