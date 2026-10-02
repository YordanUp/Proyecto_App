const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const controller = require('../controllers/inventoryController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['inventory.read']), controller.getInventory);
router.get('/warehouses', authorize(['inventory.read']), controller.getWarehouses);
router.get('/movements', authorize(['inventory.read']), controller.getMovements);
router.post('/entry', authorize(['inventory.create']), controller.addEntry);
router.post('/exit', authorize(['inventory.create']), controller.addExit);
router.post('/adjust', authorize(['inventory.adjust']), controller.adjustStock);
// inventory.adjust is the existing write permission; using it avoids breaking bootstrap roles with a new RBAC migration.
router.post('/transfer', authorize(['inventory.adjust']), controller.transferStock);

module.exports = router;
