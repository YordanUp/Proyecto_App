const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getReports, createReportController, getNotifications, createNotificationController, getAuditLogs } = require('../controllers/reportController');

const router = express.Router();

router.use(authenticateToken);

router.get('/reports', authorize(['reports.read']), getReports);
router.post('/reports', authorize(['reports.create']), createReportController);
router.get('/notifications', authorize(['notifications.read']), getNotifications);
router.post('/notifications', authorize(['notifications.create']), createNotificationController);
router.get('/audit', authorize(['audit.read']), getAuditLogs);

module.exports = router;
