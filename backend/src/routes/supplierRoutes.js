const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getSuppliers, getSupplier, createSupplierController, updateSupplier, deleteSupplier } = require('../controllers/catalogController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['suppliers.read']), getSuppliers);
router.post('/', authorize(['suppliers.create']), createSupplierController);
router.get('/:id', authorize(['suppliers.read']), getSupplier);
router.put('/:id', authorize(['suppliers.update']), updateSupplier);
router.delete('/:id', authorize(['suppliers.delete']), deleteSupplier);

module.exports = router;
