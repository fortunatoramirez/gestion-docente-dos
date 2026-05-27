const path = require('path');
const ejs = require('ejs');

const { evidenceCategories } = require('../src/utils/categories');
const { romanUnits, bytesToHuman } = require('../src/utils/filename');

const viewsRoot = path.join(__dirname, '..', 'src', 'views');
const professor = {
  id: 1,
  employee_number: '2289',
  full_name: 'RAMIREZ ARZATE FORTUNATO',
  department: 'DIEE'
};

const assignment = {
  id: 10,
  professor_name: professor.full_name,
  employee_number: professor.employee_number,
  subject_name: 'SISTEMAS DE COMPUTO Y REDES',
  subject_code: null,
  group_code: 'BM6A',
  career: 'Ingenieria Biomedica',
  semester: 'Ene-Jun 2026'
};

const common = {
  appName: 'Gestion Docente',
  currentPath: '/',
  professor
};

async function render(view, locals) {
  const html = await ejs.renderFile(path.join(viewsRoot, view), {
    ...common,
    ...locals
  });

  if (!html.includes('<!doctype html>')) {
    throw new Error(`${view} no genero HTML completo`);
  }
}

async function main() {
  await render('login.html', {
    title: 'Acceso',
    error: null,
    employeeNumber: ''
  });

  await render('dashboard.html', {
    title: 'Tablero',
    assignments: [
      {
        ...assignment,
        subject_name: assignment.subject_name,
        report_1_status: 'submitted',
        report_2_status: 'draft',
        report_3_status: null,
        report_1_files: 4,
        report_2_files: 1,
        report_3_files: 0
      }
    ]
  });

  await render('report-form.html', {
    title: 'Reporte 1',
    assignment,
    period: 1,
    report: null,
    evidenceByCategory: evidenceCategories.reduce((groups, category) => {
      groups[category.key] = [];
      return groups;
    }, {}),
    categories: evidenceCategories,
    romanUnits,
    bytesToHuman,
    reportLabel: 'Reporte parcial 1',
    saved: false,
    error: null
  });

  console.log('Smoke render OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
