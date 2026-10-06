const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getSettings, updateSetting } = require('../controllers/settingsController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['settings.read']), getSettings);
router.put('/:key', authorize(['settings.update']), updateSetting);

module.exports = router;
