const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getClients, getClient, createClientController, updateClient, deleteClient } = require('../controllers/catalogController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['clients.read']), getClients);
router.post('/', authorize(['clients.create']), createClientController);
router.get('/:id', authorize(['clients.read']), getClient);
router.put('/:id', authorize(['clients.update']), updateClient);
router.delete('/:id', authorize(['clients.delete']), deleteClient);

module.exports = router;
