const assert = require('node:assert/strict');
const db = require('../src/config/database');
const Semester = require('../src/models/semesterModel');
const Professor = require('../src/models/professorModel');
const Subject = require('../src/models/subjectModel');
const Assignment = require('../src/models/assignmentModel');
const admin = require('../src/controllers/adminController');

async function invoke(method, body = {}, id = 283) {
  const result = { status: 200 };
  const res = {
    status(code) { result.status = code; return this; },
    render(view, locals) { Object.assign(result, { view, locals }); },
    redirect(location) { result.location = location; }
  };
  await admin[method]({ body, params: { id } }, res, (error) => { result.error = error; });
  return result;
}

async function main() {
  const semesters = [{ code: '2026-3', is_current: 1 }, { code: 'Ene-Jun 2026', is_current: 0 }];
  const originalExecute = db.execute;
  db.execute = async (sql) => {
    assert(sql.includes('FROM academic_semesters'));
    assert(sql.includes('ORDER BY is_current DESC'));
    return [semesters];
  };
  try {
    assert.deepEqual(await Semester.listAll(), semesters);
  } finally { db.execute = originalExecute; }

  Semester.listAll = async () => semesters;
  Semester.current = async () => semesters.find((item) => item.is_current);
  Professor.listAll = async () => [{ id: 43, employee_number: '2856', full_name: 'LOPEZ DELGADO OSCAR JAVIER' }];
  Professor.findById = async (id) => (await Professor.listAll()).find((item) => item.id === id);
  Subject.listAll = async () => [{ id: 7, name: 'SISTEMAS DE VISION EN PROCESOS DE AUTOMATIZACION' }];
  const body = { professor_id: '43', subject_id: '7', group_code: 'IE9E', career: 'INGENIERIA ELECTRONICA', semester: '2026-3', active: '1' };
  const saved = [];
  Assignment.create = async (payload) => { saved.push(payload); return 283; };
  Assignment.update = async (id, payload) => { saved.push(payload); };
  Assignment.findByIdAdmin = async () => ({ ...body, id: 283, semester: 'Ene-Jun 2026' });

  const newForm = await invoke('newAssignment');
  assert.equal(newForm.locals.assignment.semester, '2026-3');
  assert.deepEqual(newForm.locals.semesters, semesters);
  const editForm = await invoke('editAssignment');
  assert.equal(editForm.locals.assignment.semester, 'Ene-Jun 2026');

  for (const method of ['createAssignment', 'updateAssignment']) {
    for (const semester of ['2026-3', 'Ene-Jun 2026', ' 2026-3 ']) {
      const before = saved.length;
      const result = await invoke(method, { ...body, semester });
      assert(!result.error);
      assert.equal(saved.length, before + 1);
      assert.equal(saved.at(-1).semester, semester.trim());
      assert.equal(result.location, `/admin?guardado=asignacion&semestre=${encodeURIComponent(semester.trim())}#asignaciones`);
    }
    for (const semester of ['', '2026-3 (actual)', '2026-4', '2027-1']) {
      const before = saved.length;
      const result = await invoke(method, { ...body, semester });
      assert.equal(result.status, 422);
      assert.equal(result.locals.error, 'Selecciona un semestre de la lista.');
      assert.deepEqual(result.locals.semesters, semesters);
      assert.equal(result.locals.assignment.group_code, body.group_code);
      assert.equal(result.locals.assignment.professor_id, 43);
      assert.equal(saved.length, before, 'Invalid semester must not write assignment data');
      assert(!result.location);
    }
    const excluded = await invoke(method, { ...body, group_code: 'MIM-TEST' });
    assert.equal(excluded.status, 422, 'Existing semester group restrictions must remain in effect');
  }

  semesters[0].is_current = 0;
  semesters.unshift({ code: '2027-1', is_current: 1 });
  assert.equal((await invoke('newAssignment')).locals.assignment.semester, '2027-1');
  const future = await invoke('createAssignment', { ...body, semester: '2027-1' });
  assert(future.location.includes('semestre=2027-1'), 'New configured semesters must work without hard-coded form changes');
  Professor.listAll = async () => { throw new Error('Expected lookup failure'); };
  assert.equal((await invoke('newAssignment')).error.message, 'Expected lookup failure');
  assert.equal((await invoke('editAssignment')).error.message, 'Expected lookup failure');
  console.log('PASS: configured semester list, current default, historical selection, canonical values on create/update, invalid semester rejection, preserved fields, restrictions, future semesters, lookup errors');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.end());
