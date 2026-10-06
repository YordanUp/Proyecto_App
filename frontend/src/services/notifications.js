import { apiRequest } from './api';

export const NOTIFICATIONS_CHANGED_EVENT = 'erp:notifications-changed';

export function listNotifications({ status = '', page = 1, limit = 20 } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit), sort: 'createdAt', order: 'desc' });
  if (status) query.set('status', status);
  return apiRequest(`/api/notifications?${query}`);
}

export function getUnreadNotificationCount() {
  return apiRequest('/api/notifications/unread-count');
}

export function markNotificationRead(id) {
  return apiRequest(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

export function markAllNotificationsRead() {
  return apiRequest('/api/notifications/read-all', { method: 'POST' });
}

export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}
