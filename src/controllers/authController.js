const Professor = require('../models/professorModel');

async function showLogin(req, res) {
  return res.render('login.html', {
    title: 'Acceso',
    error: null,
    employeeNumber: ''
  });
}

async function login(req, res, next) {
  try {
    const employeeNumber = String(req.body.employee_number || '').trim();
    if (!employeeNumber) {
      return res.status(422).render('login.html', {
        title: 'Acceso',
        error: 'Ingresa tu numero de empleado.',
        employeeNumber
      });
    }

    const professor = await Professor.findByEmployeeNumber(employeeNumber);
    if (!professor) {
      return res.status(404).render('login.html', {
        title: 'Acceso',
        error: 'No encontramos ese numero de empleado.',
        employeeNumber
      });
    }

    req.session.professor = professor;
    return res.redirect('/dashboard');
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
