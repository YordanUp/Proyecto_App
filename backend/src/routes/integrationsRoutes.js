const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getIntegrations, createIntegrationController } = require('../controllers/integrationsController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['integrations:read']), getIntegrations);
router.post('/', authorize(['integrations:write']), createIntegrationController);

module.exports = router;
