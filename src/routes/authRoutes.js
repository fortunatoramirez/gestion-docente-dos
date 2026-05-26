const express = require('express');
const AuthController = require('../controllers/authController');
const { redirectIfAuthenticated } = require('../middleware/auth');

const router = express.Router();

router.get('/', redirectIfAuthenticated, AuthController.showLogin);
router.post('/login', redirectIfAuthenticated, AuthController.login);
router.post('/logout', AuthController.logout);

module.exports = router;
