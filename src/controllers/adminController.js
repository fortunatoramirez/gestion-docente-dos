const Assignment = require('../models/assignmentModel');
const Professor = require('../models/professorModel');
const Subject = require('../models/subjectModel');
const { normalizeCatalogName } = require('../utils/text');

function blankProfessor() {
  return {
    employee_number: '',
    full_name: '',
    email: '',
    department: 'DIEE',
    active: 1
  };
}

function blankSubject() {
  return {
    name: '',
    subject_code: '',
    credits: ''
  };
}

function blankAssignment() {
  return {
    professor_id: '',
    subject_id: '',
    group_code: '',
    career: '',
    semester: '',
    active: 1
  };
}

function cleanText(value) {
  return String(value || '').trim();
}

function optionalText(value) {
  const clean = cleanText(value);
  return clean || null;
}

function optionalPassword(value) {
  return String(value || '').trim();
}

function checkboxActive(value) {
  return value === '1' ? 1 : 0;
}

function professorPayload(body) {
  return {
    employee_number: cleanText(body.employee_number),
    full_name: normalizeCatalogName(body.full_name),
    email: optionalText(body.email),
    department: optionalText(body.department),
    active: checkboxActive(body.active)
  };
}

function subjectPayload(body) {
  const credits = Number(body.credits);
  return {
    name: normalizeCatalogName(body.name),
    subject_code: optionalText(body.subject_code),
    credits: Number.isFinite(credits) && credits > 0 ? Math.round(credits) : null
  };
}

function assignmentPayload(body) {
  return {
    professor_id: Number(body.professor_id),
    subject_id: Number(body.subject_id),
    group_code: cleanText(body.group_code).toUpperCase(),
    career: optionalText(body.career),
    semester: cleanText(body.semester),
    active: checkboxActive(body.active)
  };
}

function validateProfessor(payload) {
  if (!payload.employee_number) return 'Ingresa el número de empleado.';
  if (!payload.full_name) return 'Ingresa el nombre completo.';
  return null;
}

function validateSubject(payload) {
  if (!payload.name) return 'Ingresa el nombre de la materia.';
  return null;
}

function validateAssignment(payload) {
  if (!payload.professor_id) return 'Selecciona un profesor.';
  if (!payload.subject_id) return 'Selecciona una materia.';
  if (!payload.group_code) return 'Ingresa el grupo.';
  if (!payload.semester) return 'Ingresa el semestre.';
  return null;
}

async function adminLookups() {
  const [professors, subjects] = await Promise.all([
    Professor.listAll(),
    Subject.listAll()
  ]);

  return { professors, subjects };
}

async function index(req, res, next) {
  try {
    const [professors, subjects, assignments] = await Promise.all([
      Professor.listAll(),
      Subject.listAll(),
      Assignment.listAllAdmin()
    ]);

    return res.render('admin-dashboard.html', {
      title: 'Administración',
      professors,
      subjects,
      assignments,
      saved: req.query.guardado || null
    });
  } catch (error) {
    return next(error);
  }
}

function renderProfessorForm(res, { title, action, professor, error = null }) {
  return res.render('admin-professor-form.html', {
    title,
    action,
    professor,
    error
  });
}

async function newProfessor(req, res) {
  return renderProfessorForm(res, {
    title: 'Nuevo profesor',
    action: '/admin/profesores',
    professor: blankProfessor()
  });
}

async function createProfessor(req, res, next) {
  try {
    const payload = professorPayload(req.body);
    const error = validateProfessor(payload);
    if (error) {
      return res.status(422).render('admin-professor-form.html', {
        title: 'Nuevo profesor',
        action: '/admin/profesores',
        professor: payload,
        error
      });
    }

    payload.temporary_password = optionalPassword(req.body.temporary_password) || payload.employee_number;
    await Professor.create(payload);
    return res.redirect('/admin?guardado=profesor');
  } catch (error) {
    return next(error);
  }
}

async function editProfessor(req, res, next) {
  try {
    const professor = await Professor.findById(req.params.id);
    if (!professor) return res.redirect('/admin');

    return renderProfessorForm(res, {
      title: 'Editar profesor',
      action: `/admin/profesores/${professor.id}`,
      professor
    });
  } catch (error) {
    return next(error);
  }
}

async function updateProfessor(req, res, next) {
  try {
    const payload = professorPayload(req.body);
    const error = validateProfessor(payload);
    if (error) {
      return res.status(422).render('admin-professor-form.html', {
        title: 'Editar profesor',
        action: `/admin/profesores/${req.params.id}`,
        professor: { id: req.params.id, ...payload },
        error
      });
    }

    await Professor.update(req.params.id, payload);

    const temporaryPassword = optionalPassword(req.body.temporary_password);
    if (temporaryPassword) {
      await Professor.setPassword(req.params.id, temporaryPassword, { mustChange: true });
      if (Number(req.session.professor.id) === Number(req.params.id)) {
        req.session.professor.must_change_password = 1;
      }
    }

    return res.redirect('/admin?guardado=profesor');
  } catch (error) {
    return next(error);
  }
}

function renderSubjectForm(res, { title, action, subject, error = null }) {
  return res.render('admin-subject-form.html', {
    title,
    action,
    subject,
    error
  });
}

async function newSubject(req, res) {
  return renderSubjectForm(res, {
    title: 'Nueva materia',
    action: '/admin/materias',
    subject: blankSubject()
  });
}

async function createSubject(req, res, next) {
  try {
    const payload = subjectPayload(req.body);
    const error = validateSubject(payload);
    if (error) {
      return res.status(422).render('admin-subject-form.html', {
        title: 'Nueva materia',
        action: '/admin/materias',
        subject: payload,
        error
      });
    }

    await Subject.create(payload);
    return res.redirect('/admin?guardado=materia');
  } catch (error) {
    return next(error);
  }
}

async function editSubject(req, res, next) {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.redirect('/admin');

    return renderSubjectForm(res, {
      title: 'Editar materia',
      action: `/admin/materias/${subject.id}`,
      subject
    });
  } catch (error) {
    return next(error);
  }
}

async function updateSubject(req, res, next) {
  try {
    const payload = subjectPayload(req.body);
    const error = validateSubject(payload);
    if (error) {
      return res.status(422).render('admin-subject-form.html', {
        title: 'Editar materia',
        action: `/admin/materias/${req.params.id}`,
        subject: { id: req.params.id, ...payload },
        error
      });
    }

    await Subject.update(req.params.id, payload);
    return res.redirect('/admin?guardado=materia');
  } catch (error) {
    return next(error);
  }
}

async function renderAssignmentForm(res, { title, action, assignment, error = null }) {
  const lookups = await adminLookups();

  return res.render('admin-assignment-form.html', {
    title,
    action,
    assignment,
    error,
    ...lookups
  });
}

async function newAssignment(req, res, next) {
  try {
    return renderAssignmentForm(res, {
      title: 'Nueva asignación',
      action: '/admin/asignaciones',
      assignment: blankAssignment()
    });
  } catch (error) {
    return next(error);
  }
}

async function createAssignment(req, res, next) {
  try {
    const payload = assignmentPayload(req.body);
    const error = validateAssignment(payload);
    if (error) {
      return res.status(422).render('admin-assignment-form.html', {
        title: 'Nueva asignación',
        action: '/admin/asignaciones',
        assignment: payload,
        error,
        ...(await adminLookups())
      });
    }

    await Assignment.create(payload);
    return res.redirect('/admin?guardado=asignacion');
  } catch (error) {
    return next(error);
  }
}

async function editAssignment(req, res, next) {
  try {
    const assignment = await Assignment.findByIdAdmin(req.params.id);
    if (!assignment) return res.redirect('/admin');

    return renderAssignmentForm(res, {
      title: 'Editar asignación',
      action: `/admin/asignaciones/${assignment.id}`,
      assignment
    });
  } catch (error) {
    return next(error);
  }
}

async function updateAssignment(req, res, next) {
  try {
    const payload = assignmentPayload(req.body);
    const error = validateAssignment(payload);
    if (error) {
      return res.status(422).render('admin-assignment-form.html', {
        title: 'Editar asignación',
        action: `/admin/asignaciones/${req.params.id}`,
        assignment: { id: req.params.id, ...payload },
        error,
        ...(await adminLookups())
      });
    }

    await Assignment.update(req.params.id, payload);
    return res.redirect('/admin?guardado=asignacion');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createAssignment,
  createProfessor,
  createSubject,
  editAssignment,
  editProfessor,
  editSubject,
  index,
  newAssignment,
  newProfessor,
  newSubject,
  updateAssignment,
  updateProfessor,
  updateSubject
};
