const express = require('express');
const ReportController = require('../controllers/reportController');
const { requireAuth } = require('../middleware/auth');
const reportUpload = require('../middleware/upload');

const router = express.Router();

router.get('/materias/:assignmentId/parcial/:period', requireAuth, ReportController.showForm);
router.post('/materias/:assignmentId/parcial/:period', requireAuth, reportUpload, ReportController.save);
router.get('/evidencias/:evidenceId/descargar', requireAuth, ReportController.downloadEvidence);
router.post('/evidencias/:evidenceId/eliminar', requireAuth, ReportController.deleteEvidence);

module.exports = router;
