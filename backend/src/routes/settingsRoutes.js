const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getSettings, createSettingController } = require('../controllers/settingsController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['settings:read']), getSettings);
router.post('/', authorize(['settings:write']), createSettingController);

module.exports = router;
