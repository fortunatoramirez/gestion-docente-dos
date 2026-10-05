const Assignment = require('../models/assignmentModel');
const Semester = require('../models/semesterModel');

async function index(req, res, next) {
  try {
    const assignments = await Assignment.listForProfessor(req.session.professor.id);
    const activeSemester = (await Semester.current()).code;
    const successMessage = req.session.reportSuccessMessage || null;
    delete req.session.reportSuccessMessage;

    return res.render('dashboard.html', {
      title: 'Tablero',
      activeSemester,
      successMessage,
      assignments
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index
};
