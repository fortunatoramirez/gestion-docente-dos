function requireAuth(req, res, next) {
  if (!req.session.professor) {
    return res.redirect('/');
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
  requireAuth,
  redirectIfAuthenticated
};
