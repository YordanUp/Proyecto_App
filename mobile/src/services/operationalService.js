function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : '';
}

async function list(request, endpoint, params = {}) {
  const response = await request(`${endpoint}${buildQuery(params)}`);
  const items = Array.isArray(response.data) ? response.data : [];
  return { items, pagination: response.pagination || { page: 1, limit: items.length, total: items.length, pages: 1 } };
}

const getDashboard = request => request('/api/dashboard');
const listInventory = (request, params) => list(request, '/api/inventory', params);
const listInventoryMovements = (request, params) => list(request, '/api/inventory/movements', params);
const createInventoryMovement = (request, type, body) => request(`/api/inventory/${type}`, { method: 'POST', body });
const listSales = (request, params) => list(request, '/api/sales', params);
const getSale = (request, id) => request(`/api/sales/${encodeURIComponent(id)}`);
const createSale = (request, body) => request('/api/sales', { method: 'POST', body });
const updateSale = (request, id, body) => request(`/api/sales/${encodeURIComponent(id)}`, { method: 'PUT', body });
const confirmSale = (request, id) => request(`/api/sales/${encodeURIComponent(id)}/confirm`, { method: 'POST' });
const cancelSale = (request, id) => request(`/api/sales/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
const listQuotations = (request, params) => list(request, '/api/sales/quotations', params);
const getQuotation = (request, id) => request(`/api/sales/quotations/${encodeURIComponent(id)}`);
const createQuotation = (request, body) => request('/api/sales/quotations', { method: 'POST', body });
const updateQuotation = (request, id, body) => request(`/api/sales/quotations/${encodeURIComponent(id)}`, { method: 'PUT', body });
const quotationAction = (request, id, action) => request(`/api/sales/quotations/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
const sendQuotation = (request, id) => quotationAction(request, id, 'send');
const acceptQuotation = (request, id) => quotationAction(request, id, 'accept');
const rejectQuotation = (request, id) => quotationAction(request, id, 'reject');
const cancelQuotation = (request, id) => quotationAction(request, id, 'cancel');
const convertQuotation = (request, id) => quotationAction(request, id, 'convert');
const listNotifications = (request, params) => list(request, '/api/notifications', params);
const getNotificationUnreadCount = async request => (await request('/api/notifications/unread-count')).data;
const getNotification = (request, id) => request(`/api/notifications/${encodeURIComponent(id)}`);
const markNotificationRead = (request, id) => request(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
const markAllNotificationsRead = (request) => request('/api/notifications/read-all', { method: 'POST' });
const listSystemSettings = async request => (await request('/api/settings')).data;
const updateSystemSetting = (request, key, value) => request(`/api/settings/${encodeURIComponent(key)}`, { method: 'PUT', body: { value } });
const listPurchases = (request, params) => list(request, '/api/purchases', params);
const getPurchase = (request, id) => request(`/api/purchases/${encodeURIComponent(id)}`);
const createPurchase = (request, body) => request('/api/purchases', { method: 'POST', body });
const updatePurchase = (request, id, body) => request(`/api/purchases/${encodeURIComponent(id)}`, { method: 'PUT', body });
const orderPurchase = (request, id) => request(`/api/purchases/${encodeURIComponent(id)}/order`, { method: 'POST' });
const receivePurchase = (request, id) => request(`/api/purchases/${encodeURIComponent(id)}/receive`, { method: 'POST' });
const cancelPurchase = (request, id) => request(`/api/purchases/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
const listReceivables = (request, params) => list(request, '/api/finance/receivables', params);
const listPayables = (request, params) => list(request, '/api/finance/payables', params);
const listFinancialMovements = (request, params) => list(request, '/api/finance/movements', params);
const registerPayment = (request, kind, id, body) => request(`/api/finance/${kind}/${encodeURIComponent(id)}/payments`, { method: 'POST', body });

module.exports = {
  buildQuery, list, getDashboard,
  listInventory, listInventoryMovements, createInventoryMovement,
  listSales, getSale, createSale, updateSale, confirmSale, cancelSale,
  listQuotations, getQuotation, createQuotation, updateQuotation, sendQuotation, acceptQuotation, rejectQuotation, cancelQuotation, convertQuotation,
  listNotifications, getNotificationUnreadCount, getNotification, markNotificationRead, markAllNotificationsRead,
  listSystemSettings, updateSystemSetting,
  listPurchases, getPurchase, createPurchase, updatePurchase, orderPurchase, receivePurchase, cancelPurchase,
  listReceivables, listPayables, listFinancialMovements, registerPayment
};
