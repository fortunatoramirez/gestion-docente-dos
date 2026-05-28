const Professor = require('../models/professorModel');
const { verifyPassword } = require('../utils/passwords');

async function showLogin(req, res) {
  return res.render('login.html', {
    title: 'Acceso',
    error: null,
    employeeNumber: ''
  });
}

async function verifyProfessorPassword(professor, password) {
  if (professor.password_hash) {
    return verifyPassword(password, professor.password_hash);
  }

  return String(password) === String(professor.employee_number);
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      return resolve();
    });
  });
}

async function login(req, res, next) {
  try {
    const employeeNumber = String(req.body.employee_number || '').trim();
    const password = String(req.body.password || '');

    if (!employeeNumber || !password) {
      return res.status(422).render('login.html', {
        title: 'Acceso',
        error: 'Ingresa tu número de empleado y contraseña.',
        employeeNumber
      });
    }

    const professor = await Professor.findByEmployeeNumber(employeeNumber);
    if (!professor) {
      return res.status(404).render('login.html', {
        title: 'Acceso',
        error: 'No encontramos ese número de empleado.',
        employeeNumber
      });
    }

    const validPassword = await verifyProfessorPassword(professor, password);
    if (!validPassword) {
      return res.status(401).render('login.html', {
        title: 'Acceso',
        error: 'La contraseña no coincide.',
        employeeNumber
      });
    }

    if (!professor.password_hash) {
      await Professor.setPassword(professor.id, password, { mustChange: true });
      professor.must_change_password = 1;
    }

    await Professor.recordLogin(professor.id);
    delete professor.password_hash;
    await regenerateSession(req);
    req.session.professor = professor;
    return res.redirect(professor.must_change_password ? '/perfil' : '/dashboard');
  } catch (error) {
    return next(error);
  }
}

function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) return next(error);
    return res.redirect('/');
  });
}

module.exports = {
  showLogin,
  login,
  logout
};
