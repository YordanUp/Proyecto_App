const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const controller = require('../controllers/authController');
const rateLimit = require('express-rate-limit');

const router = express.Router();
router.post('/login', controller.login);
router.post('/verify-email', controller.verifyEmail);
router.post('/resend-verification', rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Demasiadas solicitudes. Intente más tarde.', error: 'RATE_LIMIT_EXCEEDED' } }), controller.resendVerification);
router.get('/me', authenticateToken, controller.profile);
router.get('/profile', authenticateToken, controller.profile);
router.patch('/password', authenticateToken, controller.changePassword);
router.post('/logout', authenticateToken, controller.logout);

module.exports = router;
