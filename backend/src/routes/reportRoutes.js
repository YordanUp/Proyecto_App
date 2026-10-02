const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getNotifications, createNotificationController, getAuditLogs, getDataReport, exportDataReport } = require('../controllers/reportController');

const router = express.Router();

router.use(authenticateToken);

router.get('/data/:type/export.csv', authorize(['reports.read']), exportDataReport);
router.get('/data/:type', authorize(['reports.read']), getDataReport);
router.get('/notifications', authorize(['notifications.read']), getNotifications);
router.post('/notifications', authorize(['notifications.create']), createNotificationController);
router.get('/audit', authorize(['audit.read']), getAuditLogs);

module.exports = router;
