const { notificationSeed } = require('../data/reports');

// Notificaciones aún no tienen persistencia; se mantienen separadas de la analítica de reportes.
const notifications = notificationSeed;
function listNotifications() { return notifications; }
function createNotification(data) {
  if (!data.title || !data.message) throw new Error('Título y mensaje son requeridos');
  const notification = { id: `nt${Date.now()}`, title: data.title, message: data.message, type: data.type || 'info', read: false, createdAt: new Date().toISOString() };
  notifications.push(notification);
  return notification;
}
module.exports = { listNotifications, createNotification };
