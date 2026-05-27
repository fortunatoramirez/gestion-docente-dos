const express = require('express');
const AdminController = require('../controllers/adminController');
const { requireAdmin, requirePasswordReady } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);
router.use(requirePasswordReady);

router.get('/', AdminController.index);

router.get('/profesores/nuevo', AdminController.newProfessor);
router.post('/profesores', AdminController.createProfessor);
router.get('/profesores/:id/editar', AdminController.editProfessor);
router.post('/profesores/:id', AdminController.updateProfessor);

router.get('/materias/nueva', AdminController.newSubject);
router.post('/materias', AdminController.createSubject);
router.get('/materias/:id/editar', AdminController.editSubject);
router.post('/materias/:id', AdminController.updateSubject);

router.get('/asignaciones/nueva', AdminController.newAssignment);
router.post('/asignaciones', AdminController.createAssignment);
router.get('/asignaciones/:id/editar', AdminController.editAssignment);
router.post('/asignaciones/:id', AdminController.updateAssignment);

module.exports = router;
