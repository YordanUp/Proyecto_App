const express = require('express');
const { authorize } = require('../middleware/auth');
const controller = require('../controllers/quotationController');

const router = express.Router();
// saleRoutes aplica authenticateToken antes de montar esta ruta anidada.

router.get('/', authorize(['sales.read']), controller.list);
router.post('/', authorize(['sales.create']), controller.create);
router.get('/:id', authorize(['sales.read']), controller.get);
router.put('/:id', authorize(['sales.update']), controller.update);
router.post('/:id/send', authorize(['sales.create']), controller.send);
router.post('/:id/accept', authorize(['sales.update']), controller.accept);
router.post('/:id/reject', authorize(['sales.update']), controller.reject);
router.post('/:id/cancel', authorize(['sales.cancel']), controller.cancel);
router.post('/:id/convert', authorize(['sales.create']), controller.convert);

module.exports = router;
