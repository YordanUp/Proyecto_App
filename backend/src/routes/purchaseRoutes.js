const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const controller = require('../controllers/purchaseController');

const router = express.Router();

router.use(authenticateToken);
router.get('/', authorize(['purchases.read']), controller.listPurchases);
router.post('/', authorize(['purchases.create']), controller.createPurchase);
router.get('/orders', authorize(['purchases.read']), controller.listPurchases);
router.post('/orders', authorize(['purchases.create']), controller.createPurchase);
router.get('/:id', authorize(['purchases.read']), controller.getPurchase);
router.put('/:id', authorize(['purchases.update']), controller.updatePurchase);
router.patch('/:id', authorize(['purchases.update']), controller.updatePurchase);
router.post('/:id/order', authorize(['purchases.approve']), controller.orderPurchase);
router.post('/:id/receive', authorize(['purchases.receive']), controller.receivePurchase);
router.post('/:id/cancel', authorize(['purchases.cancel']), controller.cancelPurchase);

module.exports = router;
