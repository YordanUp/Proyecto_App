const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../src/services/operationalService');
const { hasPermission } = require('../src/services/permissions');

function recorder(response = { success: true, data: { id: 'record-1' } }) {
  const calls = [];
  const request = async (path, options = {}) => { calls.push({ path, options }); return response; };
  return { request, calls };
}

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
