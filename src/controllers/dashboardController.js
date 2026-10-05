const Assignment = require('../models/assignmentModel');
const Semester = require('../models/semesterModel');

async function index(req, res, next) {
  try {
    const assignments = await Assignment.listForProfessor(req.session.professor.id);

    return res.render('dashboard.html', {
      title: 'Tablero',
      activeSemester: (await Semester.current()).code,
      assignments
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index
};
