const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getSuppliers, createSupplierController } = require('../controllers/catalogController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['suppliers:read']), getSuppliers);
router.post('/', authorize(['suppliers:write']), createSupplierController);

module.exports = router;
