const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getPurchaseOrders, createPurchaseOrderController, getPurchases, createPurchaseController } = require('../controllers/purchaseController');

const router = express.Router();

router.use(authenticateToken);

router.get('/orders', authorize(['purchases:read']), getPurchaseOrders);
router.post('/orders', authorize(['purchases:write']), createPurchaseOrderController);
router.get('/', authorize(['purchases:read']), getPurchases);
router.post('/', authorize(['purchases:write']), createPurchaseController);

module.exports = router;
