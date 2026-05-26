const Assignment = require('../models/assignmentModel');

async function index(req, res, next) {
  try {
    const assignments = await Assignment.listForProfessor(req.session.professor.id);

    return res.render('dashboard.html', {
      title: 'Tablero',
      assignments
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index
};
