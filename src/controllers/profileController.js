const Professor = require('../models/professorModel');
const { validateNewPassword, verifyPassword } = require('../utils/passwords');

function renderProfile(res, { professor, error = null, saved = false }) {
  return res.render('profile.html', {
    title: 'Mi perfil',
    professor,
    error,
    saved
  });
}

function clearSession(req, res, next) {
  return req.session.destroy((error) => {
    if (error) return next(error);
    return res.redirect('/');
  });
}

async function show(req, res, next) {
  try {
    const professor = await Professor.findById(req.session.professor.id);
    if (!professor) return clearSession(req, res, next);

    return renderProfile(res, {
      professor: {
        ...req.session.professor,
        ...professor
      },
      saved: req.query.actualizada === '1'
    });
  } catch (error) {
    return next(error);
  }
}

async function validateCurrentPassword(professor, currentPassword) {
  if (professor.password_hash) {
    return verifyPassword(currentPassword, professor.password_hash);
  }

  return String(currentPassword) === String(professor.employee_number);
}

async function updatePassword(req, res, next) {
  try {
    const professor = await Professor.findById(req.session.professor.id);
    if (!professor) return clearSession(req, res, next);

    const currentPassword = String(req.body.current_password || '');
    const newPassword = String(req.body.new_password || '');
    const confirmPassword = String(req.body.confirm_password || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return renderProfile(res.status(422), {
        professor,
        error: 'Completa todos los campos de contrasena.'
      });
    }

    const currentIsValid = await validateCurrentPassword(professor, currentPassword);
    if (!currentIsValid) {
      return renderProfile(res.status(401), {
        professor,
        error: 'La contrasena actual no coincide.'
      });
    }

    if (newPassword !== confirmPassword) {
      return renderProfile(res.status(422), {
        professor,
        error: 'La confirmacion no coincide.'
      });
    }

    const passwordError = validateNewPassword(newPassword, professor);
    if (passwordError) {
      return renderProfile(res.status(422), {
        professor,
        error: passwordError
      });
    }

    await Professor.setPassword(professor.id, newPassword, { mustChange: false });

    req.session.professor = {
      ...req.session.professor,
      must_change_password: 0,
      password_changed_at: new Date()
    };

    return res.redirect('/perfil?actualizada=1');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  show,
  updatePassword
};
