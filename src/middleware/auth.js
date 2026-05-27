function requireAuth(req, res, next) {
  if (!req.session.professor) {
    return res.redirect('/');
  }

  return next();
}

function adminEmployeeNumbers() {
  return String(process.env.ADMIN_EMPLOYEE_NUMBERS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function isAdminProfessor(professor) {
  if (!professor) return false;
  return adminEmployeeNumbers().includes(String(professor.employee_number));
}

function requireAdmin(req, res, next) {
  if (!req.session.professor) {
    return res.redirect('/');
  }

  if (!isAdminProfessor(req.session.professor)) {
    return res.status(403).render('error.html', {
      title: 'Acceso restringido',
      message: 'Tu usuario no tiene permiso para entrar al panel de administracion.'
    });
  }

  return next();
}

function redirectIfAuthenticated(req, res, next) {
  if (req.session.professor) {
    return res.redirect('/dashboard');
  }

  return next();
}

module.exports = {
  isAdminProfessor,
  requireAdmin,
  requireAuth,
  redirectIfAuthenticated
};
