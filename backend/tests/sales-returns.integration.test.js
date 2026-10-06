require('dotenv').config();
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const testUri = process.env.TEST_MONGODB_URI;
if (testUri) {
  const isolated = new URL(testUri);
  isolated.pathname = `/erp_returns_${process.pid}_${Date.now()}`;
  process.env.MONGODB_URI = isolated.toString();
}

const app = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Role = require('../src/models/Role');
const User = require('../src/models/User');
const { Category, Client, Product, Warehouse } = require('../src/models/catalog');
const Sale = require('../src/models/Sale');
const SalesReturn = require('../src/models/SalesReturn');
const InventoryStock = require('../src/models/InventoryStock');
const InventoryMovement = require('../src/models/InventoryMovement');
const AccountsReceivable = require('../src/models/AccountsReceivable');
const FinancialMovement = require('../src/models/FinancialMovement');
const AuditLog = require('../src/models/AuditLog');
const Notification = require('../src/models/Notification');
const { PERMISSIONS } = require('../src/services/permissions');
const { hashPassword } = require('../src/services/authService');

test('RET: devoluciones persistentes ajustan stock y CxC bajo transacción, RBAC y concurrencia', {
  skip: testUri ? false : 'Define TEST_MONGODB_URI con MongoDB desechable compatible con transacciones'
}, async t => {
  await connectDatabase();
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
  t.after(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });

  const adminRole = await Role.create({ name: 'returns-admin', permissions: PERMISSIONS });
  const readerRole = await Role.create({ name: 'returns-reader', permissions: ['sales.returns.read'] });
  const adminUser = await User.create({ name: 'Admin Returns', email: 'returns-admin@test.invalid', passwordHash: await hashPassword('returns-admin-password'), role: adminRole.id });
  const readerUser = await User.create({ name: 'Reader Returns', email: 'returns-reader@test.invalid', passwordHash: await hashPassword('returns-reader-password'), role: readerRole.id });
  const category = await Category.create({ name: 'Categoría Return' });
  const customer = await Client.create({ name: 'Cliente Return', email: 'returns-customer@test.invalid' });
  const product = await Product.create({ code: 'RET-P-1', name: 'Producto Return', categoryId: category.id, purchasePrice: 1, salePrice: 10, minStock: 0 });
  const warehouse = await Warehouse.create({ name: 'Almacén Return' });
  await InventoryStock.create({ productId: product.id, warehouseId: warehouse.id, quantity: 30, reservedQuantity: 0, minimumStock: 0 });
  const adminLogin = await request(app).post('/api/auth/login').send({ email: adminUser.email, password: 'returns-admin-password' });
  const readerLogin = await request(app).post('/api/auth/login').send({ email: readerUser.email, password: 'returns-reader-password' });
  const auth = { Authorization: `Bearer ${adminLogin.body.data.token}` };
  const readerAuth = { Authorization: `Bearer ${readerLogin.body.data.token}` };
  const salesUrl = '/api/sales';
  const returnsUrl = '/api/sales/returns';

  async function confirmedSale(quantity, taxRate = 16) {
    const created = await request(app).post(salesUrl).set(auth).send({ customerId: customer.id, items: [{ productId: product.id, warehouseId: warehouse.id, quantity, unitPrice: 10, taxRate }] });
    assert.equal(created.status, 201);
    const confirmed = await request(app).post(`${salesUrl}/${created.body.data.id}/confirm`).set(auth).send({});
    assert.equal(confirmed.status, 200);
    return confirmed.body.data;
  }

  const sale = await confirmedSale(10);
  const originalSale = await Sale.findById(sale.id).lean();
  const stockAfterSale = await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id });
  assert.equal(stockAfterSale.quantity, 20);

  assert.equal((await request(app).post(returnsUrl).set(readerAuth).send({ saleId: sale.id })).status, 403, 'RET-019 permiso create');
  const first = await request(app).post(returnsUrl).set(auth).send({ saleId: sale.id, reason: 'Producto sin usar', items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 3, unitPrice: 0.01, taxRate: 0 }] });
  assert.equal(first.status, 201, 'RET-002 devolución parcial');
  assert.match(first.body.data.folio, /^DEV-\d{4}-\d{6}$/);
  assert.equal(first.body.data.total, 34.8, 'RET-012/013 importes de la venta original; ignora precio del cliente');
  assert.equal((await Sale.findById(sale.id)).total, originalSale.total, 'RET-009 no altera total histórico');
  assert.equal((await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id })).quantity, 23, 'RET-007 stock restaurado');
  const movement = await InventoryMovement.findOne({ referenceType: 'salesReturn', referenceId: first.body.data.id });
  assert.equal(movement.type, 'SALE_RETURN', 'RET-008 tipo de movimiento');
  assert.equal(String(movement.saleId), sale.id);
  assert.match(movement.reason, /DEV-.*VEN-/);
  const receivable = await AccountsReceivable.findOne({ sale: sale.id });
  assert.equal(receivable.originalAmount, 81.2, 'RET-009 CxC neta');

  const second = await request(app).post(returnsUrl).set(auth).send({ saleId: sale.id, reason: 'Segunda parcial', items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 7 }] });
  assert.equal(second.status, 201, 'RET-003 devolución parcial restante');
  assert.equal((await AccountsReceivable.findOne({ sale: sale.id })).originalAmount, 0);
  const cancelAfterReturn = await request(app).post(`${salesUrl}/${sale.id}/cancel`).set(auth).send({});
  assert.equal(cancelAfterReturn.status, 409, 'venta con devoluciones procesadas no puede cancelar su reversión total de stock');
  assert.equal(cancelAfterReturn.body.error, 'SALE_HAS_RETURNS');
  assert.equal((await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id })).quantity, 30);
  const excessive = await request(app).post(returnsUrl).set(auth).send({ saleId: sale.id, reason: 'Exceso', items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 1 }] });
  assert.equal(excessive.status, 409, 'RET-004 evita exceso');
  assert.equal(excessive.body.error, 'RETURN_QUANTITY_EXCEEDED');

  const list = await request(app).get(`${returnsUrl}?search=${first.body.data.folio}&saleId=${sale.id}&page=1&limit=1`).set(auth);
  assert.equal(list.status, 200, 'RET-016/018 filtros y paginación');
  assert.equal(list.body.pagination.total, 1);
  const detail = await request(app).get(`${returnsUrl}/${first.body.data.id}`).set(auth);
  assert.equal(detail.status, 200, 'RET-017 detalle');
  assert.equal(detail.body.data.sale.folio, sale.folio);
  assert.equal((await request(app).get(returnsUrl).set(readerAuth)).status, 200);
  assert.equal((await request(app).get(`${returnsUrl}/${new mongoose.Types.ObjectId()}`).set(auth)).status, 404);
  assert.equal(await AuditLog.countDocuments({ action: 'sales.return.created', recordId: first.body.data.id }), 1, 'RET-014 auditoría');
  assert.ok(await Notification.exists({ type: 'sales.return.processed', recordId: first.body.data.id }), 'RET-015 notificación');

  const paidSale = await confirmedSale(10, 0);
  const paidAccount = await AccountsReceivable.findOne({ sale: paidSale.id });
  assert.equal((await request(app).post(`/api/finance/receivables/${paidAccount.id}/payments`).set(auth).send({ amount: 90, paymentMethod: 'cash' })).status, 201);
  const blocked = await request(app).post(returnsUrl).set(auth).send({ saleId: paidSale.id, reason: 'Devolución mayor que el adeudo', items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 2 }] });
  assert.equal(blocked.status, 409, 'RET-011 bloquea reembolso no soportado');
  assert.equal(blocked.body.error, 'RETURN_REQUIRES_REFUND_REVIEW');
  assert.equal(await SalesReturn.countDocuments({ sale: paidSale.id }), 0, 'el bloqueo revierte devolución completa');
  assert.equal((await AccountsReceivable.findOne({ sale: paidSale.id })).paidAmount, 90, 'RET-010 conserva pagos históricos');
  assert.equal((await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id })).quantity, 20, 'el bloqueo revierte stock');
  assert.equal(await FinancialMovement.countDocuments({ accountId: paidAccount.id }), 1, 'RET-010 conserva movimiento de pago');

  const raceSale = await confirmedSale(5, 0);
  const raceBody = { saleId: raceSale.id, reason: 'Carrera concurrente', items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 3 }] };
  const race = await Promise.all([request(app).post(returnsUrl).set(auth).send(raceBody), request(app).post(returnsUrl).set(auth).send(raceBody)]);
  assert.equal(race.filter(response => response.status === 201).length, 1, 'RET-020 solo una de dos devoluciones concurrentes se confirma');
  assert.equal(race.filter(response => response.status === 409).length, 1);
  assert.equal(await SalesReturn.countDocuments({ sale: raceSale.id }), 1);
  assert.equal((await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id })).quantity, 18, 'la carrera conserva stock consistente');

  const duplicateLineSale = await request(app).post(salesUrl).set(auth).send({ customerId: customer.id, items: [
    { productId: product.id, warehouseId: warehouse.id, quantity: 2, unitPrice: 10, taxRate: 0 },
    { productId: product.id, warehouseId: warehouse.id, quantity: 3, unitPrice: 10, taxRate: 0 }
  ] });
  const duplicateConfirmed = await request(app).post(`${salesUrl}/${duplicateLineSale.body.data.id}/confirm`).set(auth).send({});
  const ambiguous = await request(app).post(returnsUrl).set(auth).send({ saleId: duplicateConfirmed.body.data.id, reason: 'Partida ambigua', items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 1 }] });
  assert.equal(ambiguous.status, 400, 'partidas repetidas requieren índice de línea');
  const fullReturn = await request(app).post(returnsUrl).set(auth).send({ saleId: duplicateConfirmed.body.data.id, reason: 'Devolución total', items: [
    { productId: product.id, warehouseId: warehouse.id, saleLineIndex: 0, quantity: 2 },
    { productId: product.id, warehouseId: warehouse.id, saleLineIndex: 1, quantity: 3 }
  ] });
  assert.equal(fullReturn.status, 201, 'RET-001 devolución total de partida duplicada');
  assert.equal(fullReturn.body.data.total, 50);
  assert.equal(fullReturn.body.data.items.length, 2);
  assert.equal((await AccountsReceivable.findOne({ sale: duplicateConfirmed.body.data.id })).balance, 0);
  assert.equal((await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id })).quantity, 18);

  const draft = await request(app).post(salesUrl).set(auth).send({ customerId: customer.id, items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 1, unitPrice: 10, taxRate: 0 }] });
  const draftReturn = await request(app).post(returnsUrl).set(auth).send({ saleId: draft.body.data.id, reason: 'Draft', items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 1 }] });
  assert.equal(draftReturn.status, 409, 'RET-005 draft no retornable');
  const cancelled = await request(app).post(`${salesUrl}/${draft.body.data.id}/cancel`).set(auth).send({});
  const cancelledReturn = await request(app).post(returnsUrl).set(auth).send({ saleId: cancelled.body.data.id, reason: 'Cancelada', items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 1 }] });
  assert.equal(cancelledReturn.status, 409, 'RET-006 cancelada no retornable');
  assert.equal(cancelledReturn.body.error, 'SALE_NOT_RETURNABLE');
});
