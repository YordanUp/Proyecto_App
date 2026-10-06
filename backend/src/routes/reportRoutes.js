const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getAuditLogs, getDataReport, exportDataReport } = require('../controllers/reportController');

const router = express.Router();

router.use(authenticateToken);

router.get('/data/:type/export.csv', authorize(['reports.read']), exportDataReport);
router.get('/data/:type', authorize(['reports.read']), getDataReport);
router.get('/audit', authorize(['audit.read']), getAuditLogs);

module.exports = router;
