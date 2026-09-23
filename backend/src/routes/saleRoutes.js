const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getQuotations, createQuotationController, getSales, createSaleController, createReturnSaleController } = require('../controllers/salesController');

const router = express.Router();

router.use(authenticateToken);

router.get('/quotations', authorize(['sales:read']), getQuotations);
router.post('/quotations', authorize(['sales:write']), createQuotationController);
router.get('/sales', authorize(['sales:read']), getSales);
router.post('/sales', authorize(['sales:write']), createSaleController);
router.post('/returns', authorize(['sales:write']), createReturnSaleController);

module.exports = router;
