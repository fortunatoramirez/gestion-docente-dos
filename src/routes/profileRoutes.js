const express = require('express');
const ProfileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, ProfileController.show);
router.post('/password', requireAuth, ProfileController.updatePassword);

module.exports = router;
