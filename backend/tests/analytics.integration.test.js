require('dotenv').config();
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const mongoose = require('mongoose');
const testUri = process.env.TEST_MONGODB_URI;
if (testUri) {
  const isolated = new URL(testUri);
  isolated.pathname = `/rpt_${process.pid}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  process.env.MONGODB_URI = isolated.toString();
}
const app = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Role = require('../src/models/Role');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const Sale = require('../src/models/Sale');
const Purchase = require('../src/models/Purchase');
const InventoryStock = require('../src/models/InventoryStock');
const InventoryMovement = require('../src/models/InventoryMovement');
const AccountsReceivable = require('../src/models/AccountsReceivable');
const AccountsPayable = require('../src/models/AccountsPayable');
const FinancialMovement = require('../src/models/FinancialMovement');
const { Category, Product, Client, Supplier, Warehouse } = require('../src/models/catalog');
const { PERMISSIONS } = require('../src/services/permissions');
const { hashPassword } = require('../src/services/authService');

test('Analytics integration: dashboard and filtered reports use persisted data and enforce permissions', {
  skip: testUri ? false : 'Define TEST_MONGODB_URI con una base desechable compatible con transacciones'
}, async t => {
  await connectDatabase();
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
  t.after(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });

  const role = await Role.create({ name: `analytics-admin-${process.pid}`, permissions: PERMISSIONS });
  const user = await User.create({ name: 'Admin reportes', email: `analytics-${process.pid}@test.invalid`, passwordHash: await hashPassword('clave-analitica-prueba-larga'), role: role.id });
  const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'clave-analitica-prueba-larga' });
  assert.equal(login.status, 200);
  const auth = { Authorization: `Bearer ${login.body.data.token}` };
  const category = await Category.create({ name: `Analytics-${process.pid}` });
  const client = await Client.create({ name: 'Cliente con coma, y "comillas"' });
  const supplier = await Supplier.create({ name: 'Proveedor analítico' });
  const product = await Product.create({ code: `AN-${process.pid}`, name: 'Producto de prueba', categoryId: category.id, purchasePrice: 4, salePrice: 10, minStock: 3 });
  const warehouse = await Warehouse.create({ name: `Almacén analytics-${process.pid}` });
  const now = new Date();
  const sale = await Sale.create({ folio: `V-AN-${process.pid}`, customer: client.id, items: [{ product: product.id, warehouse: warehouse.id, productNameSnapshot: product.name, skuSnapshot: product.code, quantity: 2, unitPrice: 10, taxRate: 0, tax: 0, subtotal: 20, total: 20 }], subtotal: 20, taxes: 0, total: 20, status: 'confirmed', createdBy: user.id, confirmedAt: now });
  const purchase = await Purchase.create({ folio: `C-AN-${process.pid}`, supplier: supplier.id, items: [{ product: product.id, warehouse: warehouse.id, productNameSnapshot: product.name, skuSnapshot: product.code, quantity: 1, unitCost: 4, taxRate: 0, tax: 0, subtotal: 4, total: 4 }], subtotal: 4, taxes: 0, total: 4, status: 'received', createdBy: user.id, receivedAt: now });
  await Purchase.create({ folio: `C-AN-P-${process.pid}`, supplier: supplier.id, items: [{ product: product.id, warehouse: warehouse.id, productNameSnapshot: product.name, skuSnapshot: product.code, quantity: 1, unitCost: 4, taxRate: 0, tax: 0, subtotal: 4, total: 4 }], subtotal: 4, taxes: 0, total: 4, status: 'ordered', createdBy: user.id });
  await InventoryStock.create({ productId: product.id, warehouseId: warehouse.id, quantity: 2, reservedQuantity: 0, minimumStock: 3 });
  const emptyWarehouse = await Warehouse.create({ name: `Almacén vacío analytics-${process.pid}` });
  await InventoryStock.create({ productId: product.id, warehouseId: emptyWarehouse.id, quantity: 0, reservedQuantity: 0, minimumStock: 3 });
  await InventoryMovement.create([
    { productId: product.id, warehouseId: warehouse.id, type: 'IN', quantity: 1, previousQuantity: 0, newQuantity: 1, reason: 'Carga inicial analytics', userId: user.id },
    { productId: product.id, warehouseId: warehouse.id, type: 'IN', quantity: 1, previousQuantity: 1, newQuantity: 2, reason: 'Segunda entrada analytics', userId: user.id }
  ]);
  const receivable = await AccountsReceivable.create({ folio: `CXC-AN-${process.pid}`, sale: sale.id, customer: client.id, originalAmount: 20, paidAmount: 5, balance: 15, status: 'partial', createdBy: user.id });
  const payable = await AccountsPayable.create({ folio: `CXP-AN-${process.pid}`, purchase: purchase.id, supplier: supplier.id, originalAmount: 4, paidAmount: 0, balance: 4, status: 'pending', createdBy: user.id });
  await FinancialMovement.create({ type: 'RECEIVABLE_PAYMENT', direction: 'IN', amount: 5, referenceType: 'sale', referenceId: sale.id, referenceModel: 'Sale', accountId: receivable.id, accountModel: 'AccountsReceivable', description: 'Pago de prueba', createdBy: user.id });
  await FinancialMovement.create({ type: 'PAYABLE_PAYMENT', direction: 'OUT', amount: 3, referenceType: 'purchase', referenceId: purchase.id, referenceModel: 'Purchase', accountId: payable.id, accountModel: 'AccountsPayable', description: 'Pago anterior de prueba', createdBy: user.id, createdAt: new Date(now.getTime() - 60_000) });

  const dashboard = await request(app).get('/api/dashboard').set(auth);
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.data.metrics.salesToday, 20);
  assert.equal(dashboard.body.data.metrics.salesMonth, 20);
  assert.equal(dashboard.body.data.metrics.confirmedSalesCount, 1);
  assert.equal(dashboard.body.data.metrics.pendingPurchases, 1);
  assert.equal(dashboard.body.data.metrics.receivedPurchasesMonth, 1);
  assert.equal(dashboard.body.data.metrics.receivables.balance, 15);
  assert.equal(dashboard.body.data.metrics.payables.balance, 4);
  assert.equal(dashboard.body.data.metrics.lowStockCount, 2);
  assert.equal(dashboard.body.data.metrics.outOfStockCount, 1);
  assert.equal(dashboard.body.data.recentSales[0].folio, sale.folio);
  assert.equal(dashboard.body.data.recentFinancialMovements.length, 2);
  assert.equal(dashboard.body.data.recentFinancialMovements[0].description, 'Pago de prueba');
  assert.equal((await request(app).get('/api/dashboard')).status, 401);

  const sales = await request(app).get(`/api/reports/data/sales?status=confirmed&customer=${client.id}&product=${product.id}&from=${now.toISOString().slice(0, 10)}&page=1&limit=1`).set(auth);
  assert.equal(sales.status, 200);
  assert.equal(sales.body.data.length, 1);
  assert.equal(sales.body.data[0].folio, sale.folio);
  assert.equal(sales.body.pagination.total, 1);
  assert.equal(sales.body.totals.total, 20);
  const byPartyName = await request(app).get('/api/reports/data/sales').query({ customer: client.name }).set(auth);
  assert.equal(byPartyName.body.pagination.total, 1);
  assert.equal((await request(app).get('/api/reports/data/sales?customer=zzzzzzzzzzzzzzzzzzzzzzzz').set(auth)).status, 400);
  assert.equal((await request(app).get('/api/reports/data/sales?from=2030-01-01&to=2020-01-01').set(auth)).status, 400);
  assert.equal((await request(app).get('/api/reports/data/sales?status=not-real').set(auth)).status, 400);
  assert.equal((await request(app).get('/api/reports/data/not-a-report').set(auth)).status, 400);

  const stockReport = await request(app).get('/api/reports/data/inventory-stock?lowStock=true').set(auth);
  assert.equal(stockReport.status, 200);
  assert.equal(stockReport.body.data.length, 2);
  assert.equal(stockReport.body.totals.quantity, 2);
  const inventoryMovements = await request(app).get('/api/reports/data/inventory-movements?movementType=IN&product=' + product.id + '&limit=1&page=1').set(auth);
  assert.equal(inventoryMovements.status, 200);
  assert.equal(inventoryMovements.body.data.length, 1);
  assert.equal(inventoryMovements.body.pagination.total, 2);
  assert.equal(inventoryMovements.body.pagination.pages, 2);
  assert.equal(inventoryMovements.body.totals.entries, 2);
  assert.equal(inventoryMovements.body.totals.movementCount, 2);
  const arReport = await request(app).get('/api/reports/data/receivables?status=partial&customer=' + client.id).set(auth);
  assert.equal(arReport.status, 200);
  assert.equal(arReport.body.totals.balance, 15);
  const apReport = await request(app).get('/api/reports/data/payables?supplier=' + supplier.id).set(auth);
  assert.equal(apReport.status, 200);
  assert.equal(apReport.body.totals.balance, 4);
  const financeReport = await request(app).get('/api/reports/data/finance-movements?movementType=RECEIVABLE_PAYMENT').set(auth);
  assert.equal(financeReport.status, 200);
  assert.equal(financeReport.body.totals.amount, 5);
  assert.equal(financeReport.body.totals.movementCount, 1);
  const financeByCustomer = await request(app).get('/api/reports/data/finance-movements').query({ customer: client.name }).set(auth);
  assert.equal(financeByCustomer.body.pagination.total, 1);

  const csv = await request(app).get(`/api/reports/data/sales/export.csv?status=confirmed&customer=${client.id}`).set(auth);
  assert.equal(csv.status, 200);
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.match(csv.text, /V-AN-/);
  assert.match(csv.text, /"Cliente con coma, y ""comillas"""/);
  assert.equal(await AuditLog.countDocuments({ action: 'report.exported', module: 'reports' }), 1);

  const readerRole = await Role.create({ name: `analytics-reader-${process.pid}`, permissions: ['dashboard.read'] });
  const reader = await User.create({ name: 'Lector sin reportes', email: `analytics-reader-${process.pid}@test.invalid`, passwordHash: await hashPassword('clave-analitica-lector-larga'), role: readerRole.id });
  const readerLogin = await request(app).post('/api/auth/login').send({ email: reader.email, password: 'clave-analitica-lector-larga' });
  const readerAuth = { Authorization: `Bearer ${readerLogin.body.data.token}` };
  assert.equal((await request(app).get('/api/reports/data/sales').set(readerAuth)).status, 403);
});
