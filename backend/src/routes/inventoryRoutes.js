const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getInventory, getWarehouses, addInventoryMovement, getMovements } = require('../controllers/inventoryController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['inventory:read']), getInventory);
router.get('/warehouses', authorize(['inventory:read']), getWarehouses);
router.get('/movements', authorize(['inventory:read']), getMovements);
router.post('/adjust', authorize(['inventory:write']), addInventoryMovement);

module.exports = router;
