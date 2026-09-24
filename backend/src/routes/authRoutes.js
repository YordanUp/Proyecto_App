const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const controller = require('../controllers/authController');

const router = express.Router();
router.post('/login', controller.login);
router.get('/me', authenticateToken, controller.profile);
router.get('/profile', authenticateToken, controller.profile);
router.patch('/password', authenticateToken, controller.changePassword);
router.post('/logout', authenticateToken, controller.logout);

module.exports = router;
