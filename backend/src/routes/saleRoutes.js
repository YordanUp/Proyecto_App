const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const controller = require('../controllers/salesController');

const router = express.Router();

router.use(authenticateToken);

router.get('/quotations', authorize(['sales.read']), controller.getQuotations);
router.post('/quotations', authorize(['sales.create']), controller.createQuotationController);
router.get('/', authorize(['sales.read']), controller.getSales);
router.post('/', authorize(['sales.create']), controller.createSaleController);
// Retain the former /api/sales/sales paths for clients deployed against the prototype.
router.get('/sales', authorize(['sales.read']), controller.getSales);
router.post('/sales', authorize(['sales.create']), controller.createSaleController);
router.get('/:id', authorize(['sales.read']), controller.getSale);
router.put('/:id', authorize(['sales.update']), controller.updateSale);
router.post('/:id/confirm', authorize(['sales.create']), controller.confirmSale);
router.post('/:id/cancel', authorize(['sales.cancel']), controller.cancelSale);
router.post('/returns', authorize(['sales.create']), controller.createReturnSaleController);

module.exports = router;
