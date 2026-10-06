require('dotenv').config();
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const testUri = process.env.TEST_MONGODB_URI;
if (testUri) { const isolated = new URL(testUri); isolated.pathname = `/erp_notifications_${process.pid}_${Date.now()}`; process.env.MONGODB_URI = isolated.toString(); }

const app = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Role = require('../src/models/Role');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const { Category, Client, Product, Supplier, Warehouse } = require('../src/models/catalog');
const InventoryStock = require('../src/models/InventoryStock');
const AccountsReceivable = require('../src/models/AccountsReceivable');
const { PERMISSIONS } = require('../src/services/permissions');
const { hashPassword } = require('../src/services/authService');
const inventoryService = require('../src/services/inventoryService');
const salesService = require('../src/services/salesService');
const purchaseService = require('../src/services/purchaseService');
const financeService = require('../src/services/financeService');
const quotationService = require('../src/services/quotationService');

test('NOT: propiedad, leído/no leído, RBAC y eventos de operación', { skip: testUri ? false : 'Define TEST_MONGODB_URI con MongoDB desechable compatible con transacciones' }, async t => {
  await connectDatabase();
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
  t.after(async () => { if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase(); await disconnectDatabase(); });

  const observerRole = await Role.create({ name: 'notifications-observer', permissions: ['notifications.read', 'inventory.read', 'sales.read', 'purchases.read', 'finance.read'] });
  const adminRole = await Role.create({ name: 'notifications-admin', permissions: PERMISSIONS });
  const limitedRole = await Role.create({ name: 'notifications-limited', permissions: ['dashboard.read'] });
  const observer = await User.create({ name: 'Notification Observer', email: 'notifications-observer@test.invalid', passwordHash: await hashPassword('notification-observer-password'), role: observerRole._id });
  const admin = await User.create({ name: 'Notification Admin', email: 'notifications-admin@test.invalid', passwordHash: await hashPassword('notification-admin-password'), role: adminRole._id });
  const limited = await User.create({ name: 'Notification Limited', email: 'notifications-limited@test.invalid', passwordHash: await hashPassword('notification-limited-password'), role: limitedRole._id });
  const tokens = await Promise.all([observer, admin, limited].map(user => request(app).post('/api/auth/login').send({ email: user.email, password: user.name === 'Notification Observer' ? 'notification-observer-password' : user.name === 'Notification Admin' ? 'notification-admin-password' : 'notification-limited-password' })));
  const [observerToken, adminToken, limitedToken] = tokens.map(result => result.body.data.token);
  const observerAuth = { Authorization: `Bearer ${observerToken}` };
  const adminAuth = { Authorization: `Bearer ${adminToken}` };
  const observerId = String(observer._id);
  const adminId = String(admin._id);

  const manual = await request(app).post('/api/notifications').set(adminAuth).send({ userId: observerId, type: 'system.test', title: 'Aviso privado', message: 'Solo para el destinatario.', module: 'system' });
  assert.equal(manual.status, 201, 'NOT-001 creación manual, con auditoría');
  const manualId = manual.body.data.id;
  assert.equal((await request(app).get('/api/notifications').set(adminAuth)).body.data.some(item => item.id === manualId), false, 'NOT-002/003 administrador tampoco consulta la bandeja de otro');
  assert.equal((await request(app).get(`/api/notifications/${manualId}`).set(adminAuth)).status, 404, 'detalle ajeno se oculta como inexistente');
  assert.equal((await request(app).post(`/api/notifications/${manualId}/read`).set(adminAuth).send()).status, 404, 'no se puede marcar notificación ajena');
  assert.equal((await request(app).get('/api/notifications/unread-count').set(observerAuth)).body.data.count, 1, 'NOT-004 contador por usuario');
  const read = await request(app).post(`/api/notifications/${manualId}/read`).set(observerAuth).send();
  assert.equal(read.status, 200, 'NOT-005 marcar una como leída'); assert.equal(read.body.data.status, 'read'); assert.ok(read.body.data.readAt, 'NOT-006 readAt se guarda');
  assert.equal((await request(app).get('/api/notifications/unread-count').set(observerAuth)).body.data.count, 0);
  assert.equal((await request(app).get('/api/notifications?status=unread&page=1&limit=20&sort=createdAt&order=desc').set(observerAuth)).status, 200, 'NOT-008 filtra no leídas');
  assert.equal((await request(app).get('/api/notifications').set({ Authorization: `Bearer ${tokens[2].body.data.token}` })).status, 403, 'NOT-009 RBAC lectura');
  assert.equal((await request(app).post('/api/notifications').set({ Authorization: `Bearer ${tokens[2].body.data.token}` }).send({ title: 'No', message: 'No' })).status, 403, 'RBAC creación manual');

  const category = await Category.create({ name: 'Notif Category' });
  const client = await Client.create({ name: 'Notif Client', email: 'notifications-client@test.invalid' });
  const supplier = await Supplier.create({ name: 'Notif Supplier', email: 'notifications-supplier@test.invalid' });
  const warehouse = await Warehouse.create({ name: 'Notif Warehouse' });
  const product = await Product.create({ code: 'NOT-P-1', name: 'Producto notificaciones', categoryId: category._id, purchasePrice: 50, salePrice: 100, minStock: 5 });
  await InventoryStock.create({ productId: product._id, warehouseId: warehouse._id, quantity: 10, reservedQuantity: 0, minimumStock: 5 });

  await inventoryService.adjustStock({ productId: product.id, warehouseId: warehouse.id, newQuantity: 2, reason: 'Conteo' }, adminId);
  assert.equal(await Notification.countDocuments({ userId: observerId, type: 'inventory.low_stock', status: 'unread' }), 1, 'NOT-010 stock bajo alerta');
  await inventoryService.adjustStock({ productId: product.id, warehouseId: warehouse.id, newQuantity: 1, reason: 'Reconteo' }, adminId);
  assert.equal(await Notification.countDocuments({ userId: observerId, type: 'inventory.low_stock', status: 'unread' }), 1, 'NOT-011 no duplica stock bajo unread');
  await inventoryService.adjustStock({ productId: product.id, warehouseId: warehouse.id, newQuantity: 20, reason: 'Reposición' }, adminId);

  const sale = await salesService.createSale({ customerId: client.id, items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 1 }] }, adminId);
  await salesService.confirmSale(sale.id, adminId);
  assert.equal(await Notification.countDocuments({ userId: observerId, type: 'sales.confirmed', recordId: sale.id }), 1, 'NOT-012 venta confirmada');

  const purchase = await purchaseService.createPurchase({ supplierId: supplier.id, items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 2 }] }, adminId);
  await purchaseService.orderPurchase(purchase.id, adminId);
  await purchaseService.receivePurchase(purchase.id, adminId);
  assert.equal(await Notification.countDocuments({ userId: observerId, type: 'purchases.received', recordId: purchase.id }), 1, 'NOT-013 compra recibida');

  const receivable = await AccountsReceivable.findOne({ sale: sale.id });
  await financeService.payReceivable(receivable.id, { amount: 10, paymentMethod: 'cash' }, adminId);
  assert.equal(await Notification.countDocuments({ userId: observerId, type: 'finance.payment_received' }), 1, 'NOT-014 pago de cliente');

  const quotation = await quotationService.createQuotation({ customerId: client.id, items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 1 }] }, adminId);
  await quotationService.transitionQuotation(quotation.id, 'send', adminId);
  await quotationService.transitionQuotation(quotation.id, 'accept', adminId);
  await quotationService.convertQuotation(quotation.id, adminId);
  assert.equal(await Notification.countDocuments({ userId: observerId, type: 'sales.quotation_converted', recordId: quotation.id }), 1, 'NOT-015 cotización convertida');

  const notifications = await Notification.find({ userId: observerId, status: 'unread' }).sort({ createdAt: -1 });
  assert.ok(notifications.length >= 5);
  const bulk = await request(app).post('/api/notifications/read-all').set(observerAuth).send();
  assert.equal(bulk.status, 200, 'NOT-007 marcar todas');
  assert.equal((await request(app).get('/api/notifications/unread-count').set(observerAuth)).body.data.count, 0);
  assert.equal(await Notification.countDocuments({ userId: observerId, status: 'unread' }), 0);
  assert.ok(await Notification.countDocuments({ userId: observerId, type: 'inventory.low_stock', status: 'read' }));
});
