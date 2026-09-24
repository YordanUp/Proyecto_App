const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getAccounts, createAccountController, getMovements, createMovementController, getPayments, createPaymentController } = require('../controllers/financeController');

const router = express.Router();

router.use(authenticateToken);

router.get('/accounts', authorize(['finance.read']), getAccounts);
router.post('/accounts', authorize(['finance.create']), createAccountController);
router.get('/movements', authorize(['finance.read']), getMovements);
router.post('/movements', authorize(['finance.create']), createMovementController);
router.get('/payments', authorize(['finance.read']), getPayments);
router.post('/payments', authorize(['finance.create']), createPaymentController);

module.exports = router;
