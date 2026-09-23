const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getAccounts, createAccountController, getMovements, createMovementController, getPayments, createPaymentController } = require('../controllers/financeController');

const router = express.Router();

router.use(authenticateToken);

router.get('/accounts', authorize(['finance:read']), getAccounts);
router.post('/accounts', authorize(['finance:write']), createAccountController);
router.get('/movements', authorize(['finance:read']), getMovements);
router.post('/movements', authorize(['finance:write']), createMovementController);
router.get('/payments', authorize(['finance:read']), getPayments);
router.post('/payments', authorize(['finance:write']), createPaymentController);

module.exports = router;
