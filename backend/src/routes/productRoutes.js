const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getProducts, getProduct, createProductController, updateProduct, deleteProduct } = require('../controllers/catalogController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['products.read']), getProducts);
router.post('/', authorize(['products.create']), createProductController);
router.get('/:id', authorize(['products.read']), getProduct);
router.put('/:id', authorize(['products.update']), updateProduct);
router.delete('/:id', authorize(['products.delete']), deleteProduct);

module.exports = router;
