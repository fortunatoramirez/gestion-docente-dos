const express = require('express');
const DashboardController = require('../controllers/dashboardController');
const { requireAuth, requirePasswordReady } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requirePasswordReady, DashboardController.index);

module.exports = router;
