const criteria = require('../../data/department-rubric-2015.json').map((c) => ({
  ...c, offices: Object.keys(c.officeEvidence)
}));
const { evidenceCategories } = require('../utils/categories');

const areas = {
  docencia: { name: 'Docencia' },
  tutoria: { name: 'Tutoría', condition: 'Tiene estudiantes asignados en el Programa Institucional de Tutoría.' },
  investigacion: { name: 'Investigación', condition: 'Tiene descarga o nombramiento para investigar, o realizó investigación básica, aplicada o educativa adicional a su carga.' },
  vinculacion: { name: 'Vinculación', condition: 'Tiene nombramiento de al menos 20 horas sin cargo administrativo, o realizó vinculación adicional a su carga.' },
  gestion: { name: 'Gestión' }
};
const conditionalAreas = Object.keys(areas).filter((key) => areas[key].condition);
const levels = ['Cero', 'No suficiente', 'Suficiente', 'Bien', 'Muy bien', 'Excelente'];
const sources = {
  docente: 'Docente', docencia: 'Jefatura de Docencia', tutorias: 'Coordinación de Tutorías',
  investigacion: 'Jefatura de Proyectos de Investigación', vinculacion: 'Jefatura de Vinculación'
};
const officeSettings = {
  tutorias: 'DEPT_TUTORIAS_EMPLOYEES',
  investigacion: 'DEPT_INVESTIGACION_EMPLOYEES',
  vinculacion: 'DEPT_VINCULACION_EMPLOYEES'
};

function officesFor(professor) {
  return Object.keys(officeSettings).filter((key) =>
    (process.env[officeSettings[key]] || '').split(',').map((item) => item.trim()).includes(String(professor.employee_number)));
}

function allowedSources(actor, criterion) {
  return [
    ...(actor.owner ? ['docente'] : []),
    ...(actor.admin ? ['docencia'] : []),
    ...actor.offices.filter((office) => criterion.offices.includes(office))
  ];
}

function applicability(item, area) {
  if (!areas[area].condition) return 'Aplica';
  if (item[area] == null) return 'Por definir';
  return Number(item[area]) === 1 ? 'Aplica' : 'No aplica';
}

function criterionRecords(item, manual, automatic, reviews, actor) {
  return criteria.filter((c) => actor.full || c.offices.some((office) => actor.offices.includes(office))).map((c) => {
    const state = applicability(item, c.area);
    const review = actor.full && state === 'Aplica' ? reviews.find((r) => r.criterion === c.id) : null;
    const contributions = manual.filter((m) => m.criterion === c.id && (actor.full || actor.offices.includes(m.source)));
    return {
      ...c, scope: state, score: review?.score ?? null, note: review?.note || '',
      manual: contributions, automatic: actor.full ? automatic.filter((a) => a.criterion === c.id) : [],
      options: allowedSources(actor, c)
    };
  });
}

// Solo los reportes enviados y los archivos con categoría identificable respaldan estos criterios.
// «Investigaciones» en un reporte de clase es una actividad del alumnado.
const categoryCriterion = { exam: 2, presentation: 3, research: 3, exercise: 3, practice: 3 };
const categoryLabels = Object.fromEntries(evidenceCategories.map((c) => [c.key, c.label]));

function automaticRecords(rows) {
  const records = [];
  const reports = new Set();
  for (const row of rows) {
    const context = [row.subject_name, row.group_code, row.period === 3 ? 'Reporte final' : 'Reporte ' + row.period].join(' · ');
    if (!reports.has(row.report_id)) {
      reports.add(row.report_id);
      records.push({ evaluation_id: row.evaluation_id, criterion: 2, title: context, context: 'Reporte enviado',
        date: row.submitted_at, assignment: row.assignment_id, period: row.period });
    }
    if (row.file_id && categoryCriterion[row.category]) {
      records.push({ evaluation_id: row.evaluation_id, criterion: categoryCriterion[row.category], title: row.original_name,
        context: context + ' · ' + categoryLabels[row.category], date: row.file_date, file: row.file_id });
    }
  }
  return records;
}

function resultLabel(c) {
  if (c.scope !== 'Aplica') return c.scope;
  return c.score == null ? 'Por valorar' : c.score + ' · ' + levels[c.score];
}

module.exports = { areas, criteria, levels, sources, conditionalAreas, officesFor, applicability,
  allowedSources, criterionRecords, automaticRecords, resultLabel };
