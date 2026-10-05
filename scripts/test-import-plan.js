const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const { validateData, buildPlan } = require('./import-semester');
const data = require('../data/semester-2026-3.json');
const db = require('../src/config/database');
const { normalizeCatalogName } = require('../src/utils/text');
after(() => db.end());

function source(employee = '2956', field = 'email') {
  return {
    semestre: { codigo: '2026-3' }, totales: { asignaciones_excluidas: 29 },
    profesores: [{ numero_empleado: employee, nombre_fuente: 'ORTEGA RAMIREZ FIDEL ALEJANDRO',
      [field]: 'fidel.ortega193@tectijuana.edu.mx', materias: [
        { nombre_carga: 'AUTOMATIZACION ROBOTICA', clave_grupo: 'BM7E', creditos: 6 }
      ] }]
  };
}
const professor = { id: 5, employee_number: '2956', full_name: 'ORTEGA RAMIREZ FIDEL ALEJANDRO', email: null };
const typo = { id: 7, name: 'AUTOMTIZACION ROBOTICA', credits: 6 };
const assignment = { id: 9, professor_id: 5, subject_id: 7, group_code: 'BM7E', semester: '2026-3', active: 1 };

test('confirmed email completes existing account and typo reuses existing assignment', () => {
  const before = JSON.stringify({ professor, typo, assignment });
  const plan = buildPlan(source(), [professor], [typo], [assignment]);
  assert.deepEqual(plan.emailUpdates, [{ id: 5, employeeNumber: '2956', email: 'fidel.ortega193@tectijuana.edu.mx' }]);
  assert.equal(plan.summary.professorsCreated.length, 0);
  assert.equal(plan.summary.subjectsCreated.length, 0);
  assert.equal(plan.summary.assignmentsReused, 1);
  assert.deepEqual(plan.summary.assignmentsInactivated, []);
  assert.deepEqual(plan.subjectCorrections, [{ id: 7, previousName: typo.name, name: 'AUTOMATIZACION ROBOTICA' }]);
  assert.equal(JSON.stringify({ professor, typo, assignment }), before);
});

test('repeat plan makes no email or name changes and preserves history', () => {
  const plan = buildPlan(source(), [{ ...professor, email: 'fidel.ortega193@tectijuana.edu.mx' }],
    [{ ...typo, name: 'AUTOMATIZACION ROBOTICA' }], [assignment,
      { ...assignment, id: 10, semester: 'Ene-Jun 2026' },
      { ...assignment, id: 11, group_code: 'MCI01' }]);
  assert.deepEqual(plan.emailUpdates, []);
  assert.deepEqual(plan.subjectCorrections, []);
  assert.deepEqual(plan.summary.assignmentsInactivated, [11]);
  assert.equal(plan.summary.assignmentsCreated, 0);
});

test('confirmed correo field is accepted and account email conflicts stop planning', () => {
  assert.equal(buildPlan(source('2956', 'correo'), [], [], []).summary.professorsCreated[0].email,
    'fidel.ortega193@tectijuana.edu.mx');
  assert.throws(() => buildPlan(source(), [{ ...professor, email: 'otro@tectijuana.edu.mx' }], [], []), /ya tiene otro correo/);
  assert.throws(() => buildPlan(source(), [professor, { id: 8, employee_number: '123', email: 'FIDEL.ORTEGA193@tectijuana.edu.mx' }], [], []), /ya pertenece/);
  assert.throws(() => buildPlan(source(), [{ id: 8, employee_number: '123', email: 'fidel.ortega193@tectijuana.edu.mx' }], [], []), /ya pertenece/);
});

test('correct catalog name wins and ambiguous typo matches are rejected', () => {
  const plan = buildPlan(source(), [], [typo, { id: 8, name: 'AUTOMATIZACION ROBOTICA' }], []);
  assert.equal(plan.assignments[0].subject.id, 8);
  assert.deepEqual(plan.subjectCorrections, []);
  assert.throws(() => buildPlan(source(), [], [typo, { ...typo, id: 8 }], []), /ambigua/);
});

test('complete source contains exact authorized roster and repeats without duplicates', () => {
  validateData(data);
  const professors = data.profesores.map((p, i) => ({ id: i + 1, employee_number: p.numero_empleado, full_name: p.nombre_fuente, email: p.email || null }));
  const subjects = [...new Set(data.profesores.flatMap((p) => p.materias.map((s) => normalizeCatalogName(s.nombre_carga))))]
    .map((name, i) => ({ id: i + 1, name }));
  let id = 0;
  const assignments = data.profesores.flatMap((p, i) => p.materias.map((s) => ({ id: ++id, professor_id: i + 1,
    subject_id: subjects.find((item) => item.name === normalizeCatalogName(s.nombre_carga)).id,
    group_code: s.clave_grupo, semester: '2026-3', active: 1 })));
  const plan = buildPlan(data, professors, subjects, assignments);
  assert.equal(plan.summary.professorsReused, 35);
  assert.equal(plan.summary.assignmentsReused, 82);
  assert.equal(plan.summary.subjectsReused, 60);
  assert.deepEqual(plan.emailUpdates, []);
  assert.deepEqual(plan.summary.assignmentsInactivated, []);
  assert(data.profesores.every((p) => p.materias.every((s) => !/^[MD]/.test(s.clave_grupo))));
  assert(!data.profesores.some((p) => p.numero_empleado === '2030' && p.materias.some((s) => s.clave_grupo === 'NT3A')));
  const invalid = structuredClone(data);
  invalid.profesores[0].materias[0].clave_grupo = 'DI1D';
  assert.throws(() => validateData(invalid), /excluida/);
});
