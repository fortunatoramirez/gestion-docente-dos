const express = require('express');
const ReportController = require('../controllers/reportController');
const { requireAuth, requirePasswordReady } = require('../middleware/auth');
const reportUpload = require('../middleware/upload');

const router = express.Router();

router.use(requireAuth);
router.use(requirePasswordReady);

router.get('/materias/:assignmentId/parcial/:period', ReportController.showForm);
router.post('/materias/:assignmentId/parcial/:period', reportUpload, ReportController.save);
router.get('/evidencias/:evidenceId/descargar', ReportController.downloadEvidence);
router.post('/evidencias/:evidenceId/eliminar', ReportController.deleteEvidence);

module.exports = router;
