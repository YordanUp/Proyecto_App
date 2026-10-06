const service = require('../services/notificationService');
const { successResponse, errorResponse } = require('../utils/response');

async function list(req, res, next) {
  try {
    const result = await service.listNotifications(req.user.id, req.query);
    return res.status(200).json({ success: true, message: 'Notificaciones consultadas correctamente', data: result.items, pagination: result.pagination });
  } catch (error) { return next(error); }
}

async function unreadCount(req, res, next) {
  try { return successResponse(res, 200, 'Contador consultado correctamente', { count: await service.getUnreadCount(req.user.id) }); }
  catch (error) { return next(error); }
}

async function get(req, res, next) {
  try {
    const item = await service.getNotification(req.params.id, req.user.id);
    return item ? successResponse(res, 200, 'Notificación consultada correctamente', item)
      : errorResponse(res, 404, 'Notificación no encontrada', 'NOTIFICATION_NOT_FOUND');
  } catch (error) { return next(error); }
}

async function markRead(req, res, next) {
  try {
    const item = await service.markAsRead(req.params.id, req.user.id);
    return item ? successResponse(res, 200, 'Notificación marcada como leída', item)
      : errorResponse(res, 404, 'Notificación no encontrada', 'NOTIFICATION_NOT_FOUND');
  } catch (error) { return next(error); }
}

async function markAllRead(req, res, next) {
  try { return successResponse(res, 200, 'Notificaciones marcadas como leídas', await service.markAllAsRead(req.user.id)); }
  catch (error) { return next(error); }
}

async function create(req, res, next) {
  try { return successResponse(res, 201, 'Notificación creada correctamente', await service.createNotification(req.body || {}, req.user.id)); }
  catch (error) { return next(error); }
}

module.exports = { list, unreadCount, get, markRead, markAllRead, create };
