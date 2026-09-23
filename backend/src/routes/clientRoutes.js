const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getClients, createClientController } = require('../controllers/catalogController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['clients:read']), getClients);
router.post('/', authorize(['clients:write']), createClientController);

module.exports = router;
