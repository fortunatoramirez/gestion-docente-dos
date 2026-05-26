const express = require('express');
const DashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, DashboardController.index);

module.exports = router;
