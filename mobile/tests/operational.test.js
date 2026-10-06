const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../src/services/operationalService');
const { hasPermission } = require('../src/services/permissions');

function recorder(response = { success: true, data: { id: 'record-1' } }) {
  const calls = [];
  const request = async (path, options = {}) => { calls.push({ path, options }); return response; };
  return { request, calls };
}

test('SET-MOB-001/002: configuración mobile consulta y actualiza keys permitidas por la API', async () => {
  const settings = [{ key: 'company_name', value: 'ERP Modular' }];
  const { request, calls } = recorder({ success: true, data: settings });
  assert.deepEqual(await api.listSystemSettings(request), settings);
  await api.updateSystemSetting(request, 'company_name', 'YordanUp');
  assert.deepEqual(calls.map(({ path, options }) => [path, options.method || 'GET', options.body]), [
    ['/api/settings', 'GET', undefined], ['/api/settings/company_name', 'PUT', { value: 'YordanUp' }]
  ]);
});

test('SET-MOB-003: settings.update habilita edición y settings.read permite consulta independiente', () => {
  const viewer = { permissions: ['settings.read'] };
  const editor = { permissions: ['settings.read', 'settings.update'] };
  assert.equal(hasPermission(viewer, 'settings.read'), true);
  assert.equal(hasPermission(viewer, 'settings.update'), false);
  assert.equal(hasPermission(editor, 'settings.update'), true);
});

test('SET-MOB-004: error de configuración de API se propaga para su presentación', async () => {
  const request = async () => { throw Object.assign(new Error('Sin acceso'), { status: 403 }); };
  await assert.rejects(api.listSystemSettings(request), error => error.status === 403 && error.message === 'Sin acceso');
});

test('MOB-DASH-001: dashboard consume métricas y secciones persistidas', async () => {
  const payload = { success: true, data: { metrics: { salesToday: 12 }, recentSales: [], recentFinancialMovements: [], stockAlerts: [] } };
  const { request, calls } = recorder(payload);
  assert.equal((await api.getDashboard(request)).data.metrics.salesToday, 12);
  assert.equal(calls[0].path, '/api/dashboard');
});

test('MOB-INV-001/002: listados usan búsqueda, filtros y paginación del backend', async () => {
  const { request, calls } = recorder({ success: true, data: [{ id: 'stock-1' }], pagination: { page: 2, limit: 20, total: 21, pages: 2 } });
  const stock = await api.listInventory(request, { search: 'SKU-1', page: 2, limit: 20, lowStock: true });
  assert.equal(stock.items[0].id, 'stock-1');
  assert.deepEqual(stock.pagination, { page: 2, limit: 20, total: 21, pages: 2 });
  assert.match(calls[0].path, /\/api\/inventory\?/);
  assert.match(calls[0].path, /search=SKU-1/);
  assert.match(calls[0].path, /lowStock=true/);
  await api.listInventoryMovements(request, { type: 'TRANSFER_OUT', page: 1, limit: 20 });
  assert.match(calls[1].path, /\/api\/inventory\/movements\?/);
  assert.match(calls[1].path, /type=TRANSFER_OUT/);
});

test('MOB-INV-003/004/005: operaciones llaman endpoints persistentes con verbos y payload correctos', async () => {
  const { request, calls } = recorder();
  const cases = [
    ['entry', { productId: 'p', warehouseId: 'w', quantity: 3, reason: 'Recepción' }],
    ['exit', { productId: 'p', warehouseId: 'w', quantity: 1, reason: 'Consumo' }],
    ['adjust', { productId: 'p', warehouseId: 'w', newQuantity: 5, reason: 'Conteo' }],
    ['transfer', { productId: 'p', fromWarehouseId: 'w1', toWarehouseId: 'w2', quantity: 2, reason: 'Traslado' }]
  ];
  for (const [type, body] of cases) await api.createInventoryMovement(request, type, body);
  assert.deepEqual(calls.map(({ path, options }) => [path, options.method, options.body]), cases.map(([type, body]) => [`/api/inventory/${type}`, 'POST', body]));
});

test('MOB-INV-006: transferencia sigue la autorización existente inventory.adjust', () => {
  assert.equal(hasPermission({ permissions: ['inventory.adjust'] }, 'inventory.adjust'), true);
  assert.equal(hasPermission({ permissions: ['inventory.read'] }, 'inventory.adjust'), false);
});

test('MOB-SALE-001..006: usa los endpoints reales de ventas para CRUD de borrador y transiciones', async () => {
  const { request, calls } = recorder();
  const sale = { customerId: 'c1', items: [{ productId: 'p1', warehouseId: 'w1', quantity: 2 }] };
  await api.listSales(request, { status: 'draft', search: 'VEN-1', page: 1, limit: 20 });
  await api.createSale(request, sale);
  await api.getSale(request, 'sale-1');
  await api.updateSale(request, 'sale-1', sale);
  await api.confirmSale(request, 'sale-1');
  await api.cancelSale(request, 'sale-1');
  assert.deepEqual(calls.map(({ path, options }) => [path.split('?')[0], options.method || 'GET']), [
    ['/api/sales', 'GET'], ['/api/sales', 'POST'], ['/api/sales/sale-1', 'GET'], ['/api/sales/sale-1', 'PUT'], ['/api/sales/sale-1/confirm', 'POST'], ['/api/sales/sale-1/cancel', 'POST']
  ]);
});

test('MOB-SALE-006: cada acción requiere permiso de UI coincidente con backend', () => {
  const user = { permissions: ['sales.read', 'sales.update'] };
  assert.equal(hasPermission(user, 'sales.read'), true);
  assert.equal(hasPermission(user, 'sales.create'), false);
  assert.equal(hasPermission(user, 'sales.cancel'), false);
});

test('RET-MOB-001..003/005: lista, consulta detalle y procesa devoluciones por endpoints protegidos', async () => {
  const { request, calls } = recorder({ success: true, data: [{ id: 'return-1' }], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
  const listed = await api.listSalesReturns(request, { saleId: 'sale-1', page: 1, limit: 20 });
  assert.equal(listed.items[0].id, 'return-1');
  await api.getSalesReturn(request, 'return-1');
  const payload = { saleId: 'sale-1', reason: 'Producto sin uso', items: [{ productId: 'p1', warehouseId: 'w1', saleLineIndex: 0, quantity: 2 }] };
  await api.createSalesReturn(request, payload);
  assert.deepEqual(calls.map(({ path, options }) => [path.split('?')[0], options.method || 'GET']), [
    ['/api/sales/returns', 'GET'], ['/api/sales/returns/return-1', 'GET'], ['/api/sales/returns', 'POST']
  ]);
  assert.match(calls[0].path, /saleId=sale-1/);
  assert.deepEqual(calls[2].options.body, payload);
});

test('RET-MOB-005/006: devolución oculta acciones sin permiso y usa SafeArea, teclado, scroll y recarga', () => {
  const fs = require('node:fs'); const path = require('node:path');
  const saleDetail = fs.readFileSync(path.join(__dirname, '../src/app/(app)/sales/[id].js'), 'utf8');
  const list = fs.readFileSync(path.join(__dirname, '../src/app/(app)/sales/returns/index.js'), 'utf8');
  const create = fs.readFileSync(path.join(__dirname, '../src/app/(app)/sales/returns/new.js'), 'utf8');
  const tabs = fs.readFileSync(path.join(__dirname, '../src/app/(app)/(tabs)/_layout.js'), 'utf8');
  const sales = fs.readFileSync(path.join(__dirname, '../src/app/(app)/(tabs)/sales.js'), 'utf8');
  assert.match(saleDetail, /hasPermission\(user, 'sales\.returns\.create'\)/);
  assert.match(saleDetail, /Crear devolución/);
  assert.match(tabs, /sales\.read/);
  assert.match(sales, /hasPermission\(user, 'sales\.returns\.read'\)/);
  assert.match(list, /hasPermission\(user, 'sales\.returns\.create'\)/);
  assert.match(list, /useFocusEffect\(useCallback\(\(\) => \{ load\(\); \}/);
  assert.match(list, /<Page refreshing=\{loading\} onRefresh=\{\(\) => load\(\)\}>/);
  assert.match(create, /KeyboardAvoidingView/);
  assert.match(create, /<Page keyboard refreshing=\{loading\} onRefresh=\{load\}>/);
  assert.match(create, /const available = Math\.max\(0, Number\(line\.quantity\) - returned\)/);
});

test('QUO-MOB-001..009: cada operación de cotización utiliza el endpoint persistente correcto', async () => {
  const { request, calls } = recorder();
  await api.listQuotations(request, { page: 2, status: 'accepted', search: 'COT-1' });
  await api.getQuotation(request, 'q-1');
  await api.createQuotation(request, { customerId: 'c1', items: [] });
  await api.updateQuotation(request, 'q-1', { customerId: 'c1', items: [] });
  await api.sendQuotation(request, 'q-1'); await api.acceptQuotation(request, 'q-1');
  await api.rejectQuotation(request, 'q-1'); await api.cancelQuotation(request, 'q-1'); await api.convertQuotation(request, 'q-1');
  assert.deepEqual(calls.map(({ path, options }) => [path.split('?')[0], options.method || 'GET']), [
    ['/api/sales/quotations', 'GET'], ['/api/sales/quotations/q-1', 'GET'], ['/api/sales/quotations', 'POST'], ['/api/sales/quotations/q-1', 'PUT'],
    ['/api/sales/quotations/q-1/send', 'POST'], ['/api/sales/quotations/q-1/accept', 'POST'], ['/api/sales/quotations/q-1/reject', 'POST'], ['/api/sales/quotations/q-1/cancel', 'POST'], ['/api/sales/quotations/q-1/convert', 'POST']
  ]);
  assert.match(calls[0].path, /page=2/); assert.match(calls[0].path, /status=accepted/); assert.match(calls[0].path, /search=COT-1/);
});

test('QUO-MOB-010: acciones de cotización coinciden con permisos de backend', () => {
  const user = { permissions: ['sales.read', 'sales.update'] };
  assert.equal(hasPermission(user, 'sales.read'), true); assert.equal(hasPermission(user, 'sales.create'), false); assert.equal(hasPermission(user, 'sales.update'), true); assert.equal(hasPermission(user, 'sales.cancel'), false);
});

test('NOT-MOB-001..005: bandeja, contador, detalle, lectura y read-all usan API persistente', async () => {
  const { request, calls } = recorder({ success: true, data: [{ id: 'notification-1', status: 'unread' }], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
  const listed = await api.listNotifications(request, { status: 'unread', page: 1, limit: 20 });
  assert.equal(listed.items[0].id, 'notification-1');
  await api.getNotificationUnreadCount(request);
  await api.getNotification(request, 'notification-1');
  await api.markNotificationRead(request, 'notification-1');
  await api.markAllNotificationsRead(request);
  assert.deepEqual(calls.map(({ path, options }) => [path.split('?')[0], options.method || 'GET']), [
    ['/api/notifications', 'GET'], ['/api/notifications/unread-count', 'GET'], ['/api/notifications/notification-1', 'GET'],
    ['/api/notifications/notification-1/read', 'POST'], ['/api/notifications/read-all', 'POST']
  ]);
  assert.match(calls[0].path, /status=unread/);
});

test('NOT-MOB-006: la sección de notificaciones respeta notifications.read', () => {
  assert.equal(hasPermission({ permissions: ['notifications.read'] }, 'notifications.read'), true);
  assert.equal(hasPermission({ permissions: ['sales.read'] }, 'notifications.read'), false);
});

test('MOB-PUR-001..006: usa los endpoints reales para crear, ordenar, recibir y cancelar', async () => {
  const { request, calls } = recorder();
  const purchase = { supplierId: 's1', items: [{ productId: 'p1', warehouseId: 'w1', quantity: 2 }] };
  await api.listPurchases(request, { status: 'ordered', page: 1, limit: 20 });
  await api.createPurchase(request, purchase);
  await api.getPurchase(request, 'purchase-1');
  await api.updatePurchase(request, 'purchase-1', purchase);
  await api.orderPurchase(request, 'purchase-1');
  await api.receivePurchase(request, 'purchase-1');
  await api.cancelPurchase(request, 'purchase-1');
  assert.deepEqual(calls.map(({ path, options }) => [path.split('?')[0], options.method || 'GET']), [
    ['/api/purchases', 'GET'], ['/api/purchases', 'POST'], ['/api/purchases/purchase-1', 'GET'], ['/api/purchases/purchase-1', 'PUT'], ['/api/purchases/purchase-1/order', 'POST'], ['/api/purchases/purchase-1/receive', 'POST'], ['/api/purchases/purchase-1/cancel', 'POST']
  ]);
});

test('MOB-FIN-001..006: cuenta y pagos usan los endpoints persistentes y métodos admitidos', async () => {
  const { request, calls } = recorder();
  await api.listReceivables(request, { status: 'partial', search: 'VEN-1', page: 1, limit: 20 });
  await api.listPayables(request, { status: 'pending', page: 1, limit: 20 });
  await api.listFinancialMovements(request, { direction: 'IN', page: 1, limit: 20 });
  await api.registerPayment(request, 'receivables', 'ar-1', { amount: 5, paymentMethod: 'cash', description: 'Abono' });
  await api.registerPayment(request, 'payables', 'ap-1', { amount: 4, paymentMethod: 'transfer' });
  assert.deepEqual(calls.map(({ path, options }) => [path.split('?')[0], options.method || 'GET']), [
    ['/api/finance/receivables', 'GET'], ['/api/finance/payables', 'GET'], ['/api/finance/movements', 'GET'], ['/api/finance/receivables/ar-1/payments', 'POST'], ['/api/finance/payables/ap-1/payments', 'POST']
  ]);
  assert.deepEqual(calls[3].options.body, { amount: 5, paymentMethod: 'cash', description: 'Abono' });
});

test('INT-MOB-001..005: lista, detalle, alta, edición y estado usan endpoints reales', async () => {
  const { request, calls } = recorder({ success: true, data: [{ id: 'integration-1', enabled: false }], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
  const page = await api.listIntegrations(request, { search: 'WhatsApp', type: 'messaging', enabled: false, page: 1, limit: 20 });
  assert.equal(page.items[0].id, 'integration-1');
  assert.match(calls[0].path, /search=WhatsApp/); assert.match(calls[0].path, /type=messaging/); assert.match(calls[0].path, /enabled=false/);
  await api.getIntegration(request, 'integration-1');
  await api.createIntegration(request, { name: 'WhatsApp Business', slug: 'whatsapp-business', type: 'messaging', config: {} });
  await api.updateIntegration(request, 'integration-1', { name: 'WhatsApp Business MX', type: 'messaging' });
  await api.enableIntegration(request, 'integration-1'); await api.disableIntegration(request, 'integration-1');
  assert.deepEqual(calls.map(({ path, options }) => [path.split('?')[0], options.method || 'GET']), [
    ['/api/integrations', 'GET'], ['/api/integrations/integration-1', 'GET'], ['/api/integrations', 'POST'],
    ['/api/integrations/integration-1', 'PUT'], ['/api/integrations/integration-1/enable', 'POST'], ['/api/integrations/integration-1/disable', 'POST']
  ]);
});

test('INT-MOB-006: acciones mobile se limitan a permisos RBAC del backend', () => {
  const viewer = { permissions: ['integrations.read'] };
  const editor = { permissions: ['integrations.read', 'integrations.update'] };
  const creator = { permissions: ['integrations.read', 'integrations.create'] };
  assert.equal(hasPermission(viewer, 'integrations.read'), true); assert.equal(hasPermission(viewer, 'integrations.update'), false);
  assert.equal(hasPermission(editor, 'integrations.update'), true); assert.equal(hasPermission(editor, 'integrations.create'), false);
  assert.equal(hasPermission(creator, 'integrations.create'), true); assert.equal(hasPermission(creator, 'integrations.update'), false);
});

test('INT-MOB-007: pantalla de integraciones usa SafeArea/ScrollView, teclado y recarga al volver o refrescar', () => {
  const fs = require('node:fs'); const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../src/app/(app)/integrations/index.js'), 'utf8');
  assert.match(source, /<Page keyboard refreshing=\{loading\} onRefresh=\{load\}/);
  assert.match(source, /KeyboardAvoidingView style=\{\{ flex: 1 \}\} behavior=/);
  assert.match(source, /useFocusEffect\(useCallback\(\(\) => \{ load\(\); \}/);
  assert.match(source, /listIntegrations\(request/);
});
