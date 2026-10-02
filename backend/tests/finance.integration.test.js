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
  isolated.pathname = `/fin_${process.pid}_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  process.env.MONGODB_URI = isolated.toString();
}
const app = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Role = require('../src/models/Role');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const InventoryStock = require('../src/models/InventoryStock');
const InventoryMovement = require('../src/models/InventoryMovement');
const Sale = require('../src/models/Sale');
const Purchase = require('../src/models/Purchase');
const AccountsReceivable = require('../src/models/AccountsReceivable');
const AccountsPayable = require('../src/models/AccountsPayable');
const FinancialMovement = require('../src/models/FinancialMovement');
const Sequence = require('../src/models/Sequence');
const { Category, Client, Product, Supplier, Warehouse } = require('../src/models/catalog');
const { PERMISSIONS } = require('../src/services/permissions');
const { hashPassword } = require('../src/services/authService');

test('MongoDB integration: receivables, payables, payments and source transactions', {
  skip: testUri ? false : 'Define TEST_MONGODB_URI con una instancia de MongoDB desechable compatible con transacciones'
}, async t => {
  await connectDatabase();
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
  t.after(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });

  const role = await Role.create({ name: `finance-admin-${process.pid}`, permissions: PERMISSIONS });
  const user = await User.create({ name: 'Admin finanzas', email: `finance-${process.pid}@test.invalid`, passwordHash: await hashPassword('clave-finanzas-prueba-larga'), role: role.id });
  const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'clave-finanzas-prueba-larga' });
  assert.equal(login.status, 200);
  const token = login.body.data.token;
  const auth = { Authorization: `Bearer ${token}` };
  const category = await Category.create({ name: `Finanzas-${process.pid}` });
  const customer = await Client.create({ name: 'Cliente Finanzas' });
  const supplier = await Supplier.create({ name: 'Proveedor Finanzas' });
  const product = await Product.create({ code: `FIN-${process.pid}`, name: 'Producto Financiero', categoryId: category.id, purchasePrice: 50, salePrice: 100, minStock: 2 });
  const warehouse = await Warehouse.create({ name: `Almacén Finanzas-${process.pid}` });
  await InventoryStock.create({ productId: product.id, warehouseId: warehouse.id, quantity: 100, reservedQuantity: 5, minimumStock: 2 });

  async function createSale(quantity = 10) {
    const response = await request(app).post('/api/sales').set(auth).send({ customerId: customer.id, items: [{ productId: product.id, warehouseId: warehouse.id, quantity, unitPrice: 100 }] });
    assert.equal(response.status, 201);
    return response.body.data;
  }
  async function confirmSale(sale) { return request(app).post(`/api/sales/${sale.id}/confirm`).set(auth).send({}); }
  async function createPurchase(quantity = 20) {
    const response = await request(app).post('/api/purchases').set(auth).send({ supplierId: supplier.id, items: [{ productId: product.id, warehouseId: warehouse.id, quantity, unitCost: 50 }] });
    assert.equal(response.status, 201);
    return response.body.data;
  }
  async function receivePurchase(purchase) {
    const ordered = await request(app).post(`/api/purchases/${purchase.id}/order`).set(auth).send({});
    assert.equal(ordered.status, 200);
    return request(app).post(`/api/purchases/${purchase.id}/receive`).set(auth).send({});
  }

  // FIN-001/003: confirming a sale atomically creates exactly one receivable.
  const sale = await createSale(10);
  const stockBeforeSale = await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id });
  const confirmed = await confirmSale(sale);
  assert.equal(confirmed.status, 200);
  let receivable = await AccountsReceivable.findOne({ sale: sale.id });
  assert.ok(receivable);
  assert.equal(receivable.folio.startsWith('CXC-'), true);
  assert.equal(receivable.originalAmount, 1000);
  assert.equal(receivable.paidAmount, 0);
  assert.equal(receivable.balance, 1000);
  assert.equal(receivable.status, 'pending');
  assert.equal(await AccountsReceivable.countDocuments({ sale: sale.id }), 1);
  assert.equal((await confirmSale(sale)).status, 409);
  assert.equal(await AccountsReceivable.countDocuments({ sale: sale.id }), 1);
  assert.equal((await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id })).quantity, stockBeforeSale.quantity - 10);

  const receivableList = await request(app).get('/api/finance/receivables?search=Cliente%20Finanzas&status=pending&page=1&limit=10').set(auth);
  assert.equal(receivableList.status, 200);
  assert.equal(receivableList.body.data.some(item => item.id === String(receivable.id)), true);
  assert.equal((await request(app).get(`/api/finance/receivables/${receivable.id}`).set(auth)).status, 200);

  // FIN-005/007/006/011: partial payment, overpayment guard, full payment and IN movements.
  const partial = await request(app).post(`/api/finance/receivables/${receivable.id}/payments`).set(auth).send({ amount: 400, paymentMethod: 'transfer' });
  assert.equal(partial.status, 201);
  assert.equal(partial.body.data.account.paidAmount, 400);
  assert.equal(partial.body.data.account.balance, 600);
  assert.equal(partial.body.data.account.status, 'partial');
  assert.equal(partial.body.data.movement.direction, 'IN');
  const overpayReceivable = await request(app).post(`/api/finance/receivables/${receivable.id}/payments`).set(auth).send({ amount: 600.01 });
  assert.equal(overpayReceivable.status, 409);
  assert.equal(overpayReceivable.body.error, 'PAYMENT_EXCEEDS_BALANCE');
  const full = await request(app).post(`/api/finance/receivables/${receivable.id}/payments`).set(auth).send({ amount: 600 });
  assert.equal(full.status, 201);
  assert.equal(full.body.data.account.status, 'paid');
  assert.equal(full.body.data.account.balance, 0);
  assert.ok(full.body.data.account.paidAt);
  assert.equal((await request(app).post(`/api/finance/receivables/${receivable.id}/payments`).set(auth).send({ amount: 1 })).status, 409);
  assert.equal(await FinancialMovement.countDocuments({ accountId: receivable.id, direction: 'IN' }), 2);

  // FIN-002/004/008/009/010/011: receipt atomically creates one payable; outgoing payments update it.
  const purchase = await createPurchase(20);
  const purchaseReceipt = await receivePurchase(purchase);
  assert.equal(purchaseReceipt.status, 200);
  let payable = await AccountsPayable.findOne({ purchase: purchase.id });
  assert.ok(payable);
  assert.equal(payable.folio.startsWith('CXP-'), true);
  assert.equal(payable.originalAmount, 1000);
  assert.equal(payable.balance, 1000);
  assert.equal(payable.status, 'pending');
  assert.equal(await AccountsPayable.countDocuments({ purchase: purchase.id }), 1);
  assert.equal((await request(app).post(`/api/purchases/${purchase.id}/receive`).set(auth).send({})).status, 409);
  assert.equal(await AccountsPayable.countDocuments({ purchase: purchase.id }), 1);
  const payableList = await request(app).get('/api/finance/payables?search=Proveedor%20Finanzas&status=pending&page=1&limit=10').set(auth);
  assert.equal(payableList.status, 200);
  assert.equal(payableList.body.data.some(item => item.id === String(payable.id)), true);
  assert.equal((await request(app).get(`/api/finance/payables/${payable.id}`).set(auth)).status, 200);
  const concurrentPurchases = await Promise.all([createPurchase(1), createPurchase(1)]);
  const concurrentReceipts = await Promise.all(concurrentPurchases.map(receivePurchase));
  assert.ok(concurrentReceipts.every(response => response.status === 200));
  const concurrentPayables = await AccountsPayable.find({ purchase: { $in: concurrentPurchases.map(item => item.id) } }).lean();
  assert.equal(concurrentPayables.length, 2);
  assert.equal(new Set(concurrentPayables.map(item => item.folio)).size, 2, 'FIN-013: folios CXP concurrentes únicos');

  const partialPayable = await request(app).post(`/api/finance/payables/${payable.id}/payments`).set(auth).send({ amount: 300, paymentMethod: 'check' });
  assert.equal(partialPayable.status, 201);
  assert.equal(partialPayable.body.data.account.paidAmount, 300);
  assert.equal(partialPayable.body.data.account.balance, 700);
  assert.equal(partialPayable.body.data.account.status, 'partial');
  assert.equal(partialPayable.body.data.movement.direction, 'OUT');
  const overpayPayable = await request(app).post(`/api/finance/payables/${payable.id}/payments`).set(auth).send({ amount: 701 });
  assert.equal(overpayPayable.status, 409);
  const completePayable = await request(app).post(`/api/finance/payables/${payable.id}/payments`).set(auth).send({ amount: 700 });
  assert.equal(completePayable.status, 201);
  assert.equal(completePayable.body.data.account.status, 'paid');
  assert.equal(completePayable.body.data.account.balance, 0);
  assert.ok(completePayable.body.data.account.paidAt);
  assert.equal(await FinancialMovement.countDocuments({ accountId: payable.id, direction: 'OUT' }), 2);

  // FIN-016/017: unpaid sale cancellation cancels its account; with payments it is blocked without erasing history.
  const unpaidSale = await createSale(1);
  assert.equal((await confirmSale(unpaidSale)).status, 200);
  const unpaidReceivable = await AccountsReceivable.findOne({ sale: unpaidSale.id });
  assert.equal((await request(app).post(`/api/sales/${unpaidSale.id}/cancel`).set(auth).send({})).status, 200);
  assert.equal((await AccountsReceivable.findById(unpaidReceivable.id)).status, 'cancelled');
  const partiallyPaidSale = await createSale(2);
  assert.equal((await confirmSale(partiallyPaidSale)).status, 200);
  const partialSaleAccount = await AccountsReceivable.findOne({ sale: partiallyPaidSale.id });
  assert.equal((await request(app).post(`/api/finance/receivables/${partialSaleAccount.id}/payments`).set(auth).send({ amount: 50 })).status, 201);
  const movementsBeforeBlockedCancel = await FinancialMovement.countDocuments({ accountId: partialSaleAccount.id });
  const blockedCancel = await request(app).post(`/api/sales/${partiallyPaidSale.id}/cancel`).set(auth).send({});
  assert.equal(blockedCancel.status, 409);
  assert.equal(blockedCancel.body.error, 'SALE_HAS_PAYMENTS');
  assert.equal((await Sale.findById(partiallyPaidSale.id)).status, 'confirmed');
  assert.equal((await AccountsReceivable.findById(partialSaleAccount.id)).status, 'partial');
  assert.equal(await FinancialMovement.countDocuments({ accountId: partialSaleAccount.id }), movementsBeforeBlockedCancel);

  // FIN-014: two simultaneous $700 payments against $1000 cannot overdraw.
  const concurrentSale = await createSale(10);
  assert.equal((await confirmSale(concurrentSale)).status, 200);
  const concurrentAccount = await AccountsReceivable.findOne({ sale: concurrentSale.id });
  const concurrentPayments = await Promise.all(Array.from({ length: 2 }, () => request(app).post(`/api/finance/receivables/${concurrentAccount.id}/payments`).set(auth).send({ amount: 700 })));
  assert.equal(concurrentPayments.filter(response => response.status === 201).length, 1);
  assert.equal(concurrentPayments.filter(response => response.status === 409).length, 1);
  const concurrentAfter = await AccountsReceivable.findById(concurrentAccount.id);
  assert.equal(concurrentAfter.paidAmount, 700);
  assert.equal(concurrentAfter.balance, 300);
  assert.ok(concurrentAfter.balance >= 0);
  assert.equal(await FinancialMovement.countDocuments({ accountId: concurrentAccount.id }), 1);
  const concurrentFoliosSales = await Promise.all([createSale(1), createSale(1)]);
  const concurrentFoliosConfirmed = await Promise.all(concurrentFoliosSales.map(confirmSale));
  assert.ok(concurrentFoliosConfirmed.every(response => response.status === 200));
  const concurrentReceivables = await AccountsReceivable.find({ sale: { $in: concurrentFoliosSales.map(item => item.id) } }).lean();
  assert.equal(concurrentReceivables.length, 2);
  assert.equal(new Set(concurrentReceivables.map(item => item.folio)).size, 2, 'FIN-013: folios CXC concurrentes únicos');

  // FIN-015/022: fail after conditional balance update; transaction restores account, movement and audit.
  const rollbackSale = await createSale(5);
  assert.equal((await confirmSale(rollbackSale)).status, 200);
  const rollbackAccount = await AccountsReceivable.findOne({ sale: rollbackSale.id });
  const auditBeforeRollback = await AuditLog.countDocuments({ module: 'finance', recordId: String(rollbackAccount.id) });
  const movementBeforeRollback = await FinancialMovement.countDocuments({ accountId: rollbackAccount.id });
  const originalMovementCreate = FinancialMovement.create;
  FinancialMovement.create = function failMovementAfterBalance(...args) { throw new Error('FIN-015 simulated movement failure'); };
  let rollbackPayment;
  try { rollbackPayment = await request(app).post(`/api/finance/receivables/${rollbackAccount.id}/payments`).set(auth).send({ amount: 100 }); }
  finally { FinancialMovement.create = originalMovementCreate; }
  assert.equal(rollbackPayment.status, 500);
  const afterRollback = await AccountsReceivable.findById(rollbackAccount.id);
  assert.equal(afterRollback.paidAmount, 0);
  assert.equal(afterRollback.balance, 500);
  assert.equal(afterRollback.status, 'pending');
  assert.equal(await FinancialMovement.countDocuments({ accountId: rollbackAccount.id }), movementBeforeRollback);
  assert.equal(await AuditLog.countDocuments({ module: 'finance', recordId: String(rollbackAccount.id) }), auditBeforeRollback);

  // A failure creating a source account also rolls back the sale/purchase state and inventory.
  const saleCreationRollback = await createSale(1);
  const saleStockBefore = await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id });
  const originalReceivableCreate = AccountsReceivable.create;
  AccountsReceivable.create = function failReceivableCreate() { throw new Error('FIN-ROLLBACK receivable create failure'); };
  let saleRollback;
  try { saleRollback = await confirmSale(saleCreationRollback); }
  finally { AccountsReceivable.create = originalReceivableCreate; }
  assert.equal(saleRollback.status, 500);
  assert.equal((await Sale.findById(saleCreationRollback.id)).status, 'draft');
  assert.equal(await AccountsReceivable.countDocuments({ sale: saleCreationRollback.id }), 0);
  assert.equal((await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id })).quantity, saleStockBefore.quantity);

  const purchaseCreationRollback = await createPurchase(2);
  const orderRollback = await request(app).post(`/api/purchases/${purchaseCreationRollback.id}/order`).set(auth).send({});
  assert.equal(orderRollback.status, 200);
  const purchaseStockBefore = await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id });
  const originalPayableCreate = AccountsPayable.create;
  AccountsPayable.create = function failPayableCreate() { throw new Error('FIN-ROLLBACK payable create failure'); };
  let purchaseRollback;
  try { purchaseRollback = await request(app).post(`/api/purchases/${purchaseCreationRollback.id}/receive`).set(auth).send({}); }
  finally { AccountsPayable.create = originalPayableCreate; }
  assert.equal(purchaseRollback.status, 500);
  assert.equal((await Purchase.findById(purchaseCreationRollback.id)).status, 'ordered');
  assert.equal(await AccountsPayable.countDocuments({ purchase: purchaseCreationRollback.id }), 0);
  assert.equal((await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id })).quantity, purchaseStockBefore.quantity);

  // FIN-012: read-only finance users cannot post either side's payments.
  const readRole = await Role.create({ name: `finance-reader-${process.pid}`, permissions: ['finance.read'] });
  const reader = await User.create({ name: 'Lector financiero', email: `finance-reader-${process.pid}@test.invalid`, passwordHash: await hashPassword('clave-lector-finanzas-larga'), role: readRole.id });
  const readerLogin = await request(app).post('/api/auth/login').send({ email: reader.email, password: 'clave-lector-finanzas-larga' });
  const readerAuth = { Authorization: `Bearer ${readerLogin.body.data.token}` };
  assert.equal((await request(app).get('/api/finance/receivables').set(readerAuth)).status, 200);
  assert.equal((await request(app).post(`/api/finance/receivables/${rollbackAccount.id}/payments`).set(readerAuth).send({ amount: 1 })).status, 403);
  assert.equal((await request(app).post(`/api/finance/payables/${payable.id}/payments`).set(readerAuth).send({ amount: 1 })).status, 403);

  const movements = await request(app).get('/api/finance/movements?from=2026-01-01&to=2030-12-31&page=1&limit=100').set(auth);
  assert.equal(movements.status, 200);
  assert.ok(movements.body.data.some(item => item.type === 'RECEIVABLE_PAYMENT' && item.direction === 'IN'));
  assert.ok(movements.body.data.some(item => item.type === 'PAYABLE_PAYMENT' && item.direction === 'OUT'));
  assert.ok((await Sequence.findOne({ _id: `receivable:${new Date().getUTCFullYear()}` })).value >= 1);
  assert.ok((await Sequence.findOne({ _id: `payable:${new Date().getUTCFullYear()}` })).value >= 1);
  const financeLogs = await AuditLog.find({ module: 'finance' }).lean();
  for (const action of ['receivable.created', 'receivable.payment', 'receivable.paid', 'receivable.cancelled', 'payable.created', 'payable.payment', 'payable.paid', 'finance.movement.created']) {
    assert.ok(financeLogs.some(entry => entry.action === action), `auditoría ${action}`);
  }
});
