const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const controller = require('../controllers/financeController');

const router = express.Router();
router.use(authenticateToken);

router.get('/receivables', authorize(['finance.read']), controller.getReceivables);
router.get('/receivables/:id', authorize(['finance.read']), controller.getReceivable);
router.post('/receivables/:id/payments', authorize(['finance.receive_payment']), controller.payReceivable);
router.get('/payables', authorize(['finance.read']), controller.getPayables);
router.get('/payables/:id', authorize(['finance.read']), controller.getPayable);
router.post('/payables/:id/payments', authorize(['finance.make_payment']), controller.payPayable);
router.get('/movements', authorize(['finance.read']), controller.getMovements);
// The former generic payments endpoint is a read-only alias to the immutable movement ledger.
router.get('/payments', authorize(['finance.read']), controller.getMovements);

module.exports = router;
