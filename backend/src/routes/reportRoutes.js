const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getReports, createReportController, getNotifications, createNotificationController, getAuditLogs, createAuditLogController } = require('../controllers/reportController');

const router = express.Router();

router.use(authenticateToken);

router.get('/reports', authorize(['reports:read']), getReports);
router.post('/reports', authorize(['reports:write']), createReportController);
router.get('/notifications', authorize(['notifications:read']), getNotifications);
router.post('/notifications', authorize(['notifications:write']), createNotificationController);
router.get('/audit', authorize(['audit:read']), getAuditLogs);
router.post('/audit', authorize(['audit:write']), createAuditLogController);

module.exports = router;
