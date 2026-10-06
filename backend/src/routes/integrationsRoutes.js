const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const controller = require('../controllers/integrationsController');

const router = express.Router();
router.use(authenticateToken);
router.get('/', authorize(['integrations.read']), controller.getIntegrations);
router.post('/', authorize(['integrations.create']), controller.createIntegration);
router.get('/:id', authorize(['integrations.read']), controller.getIntegration);
router.put('/:id', authorize(['integrations.update']), controller.updateIntegration);
router.post('/:id/enable', authorize(['integrations.update']), controller.enableIntegration);
router.post('/:id/disable', authorize(['integrations.update']), controller.disableIntegration);

module.exports = router;
