const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getDashboard } = require('../controllers/dashboardController');

const router = express.Router();

router.use(authenticateToken);
router.get('/', authorize(['dashboard.read']), getDashboard);

module.exports = router;
