const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const controller = require('../controllers/notificationController');

const router = express.Router();
router.use(authenticateToken);
router.get('/', authorize(['notifications.read']), controller.list);
router.get('/unread-count', authorize(['notifications.read']), controller.unreadCount);
router.post('/read-all', authorize(['notifications.read']), controller.markAllRead);
router.post('/', authorize(['notifications.create']), controller.create);
router.get('/:id', authorize(['notifications.read']), controller.get);
router.post('/:id/read', authorize(['notifications.read']), controller.markRead);

module.exports = router;
