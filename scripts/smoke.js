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
  professor,
  isAdmin: true
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

  await render('admin-dashboard.html', {
    title: 'Administracion',
    saved: null,
    professors: [
      {
        id: professor.id,
        employee_number: professor.employee_number,
        full_name: professor.full_name,
        email: null,
        active: 1
      }
    ],
    subjects: [
      {
        id: 1,
        name: assignment.subject_name,
        subject_code: null,
        credits: 4
      }
    ],
    assignments: [
      {
        ...assignment,
        professor_id: professor.id,
        subject_id: 1,
        active: 1
      }
    ]
  });

  await render('admin-professor-form.html', {
    title: 'Nuevo profesor',
    action: '/admin/profesores',
    professor: {
      employee_number: '',
      full_name: '',
      email: '',
      department: 'DIEE',
      active: 1
    },
    error: null
  });

  await render('admin-subject-form.html', {
    title: 'Nueva materia',
    action: '/admin/materias',
    subject: {
      name: '',
      subject_code: '',
      credits: ''
    },
    error: null
  });

  await render('admin-assignment-form.html', {
    title: 'Nueva asignacion',
    action: '/admin/asignaciones',
    assignment: {
      professor_id: '',
      subject_id: '',
      group_code: '',
      career: '',
      semester: '',
      active: 1
    },
    professors: [
      {
        id: professor.id,
        employee_number: professor.employee_number,
        full_name: professor.full_name
      }
    ],
    subjects: [
      {
        id: 1,
        name: assignment.subject_name,
        subject_code: null
      }
    ],
    error: null
  });

  console.log('Smoke render OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
