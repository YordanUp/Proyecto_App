require('dotenv').config();
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const testUri = process.env.TEST_MONGODB_URI;
if (testUri) {
  const isolated = new URL(testUri);
  isolated.pathname = `/erp_quotations_${process.pid}_${Date.now()}`;
  process.env.MONGODB_URI = isolated.toString();
}

const app = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Role = require('../src/models/Role');
const User = require('../src/models/User');
const { Category, Client, Product, Warehouse } = require('../src/models/catalog');
const Quotation = require('../src/models/Quotation');
const Sale = require('../src/models/Sale');
const InventoryStock = require('../src/models/InventoryStock');
const InventoryMovement = require('../src/models/InventoryMovement');
const AccountsReceivable = require('../src/models/AccountsReceivable');
const FinancialMovement = require('../src/models/FinancialMovement');
const AuditLog = require('../src/models/AuditLog');
const { PERMISSIONS } = require('../src/services/permissions');
const { hashPassword } = require('../src/services/authService');

test('QUO: persistencia, estados, RBAC, conversión y rollback transaccional', {
  skip: testUri ? false : 'Define TEST_MONGODB_URI con MongoDB desechable compatible con transacciones'
}, async t => {
  await connectDatabase();
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
  t.after(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });

  const adminRole = await Role.create({ name: 'quotation-admin', permissions: PERMISSIONS });
  const limitedRole = await Role.create({ name: 'quotation-limited', permissions: ['dashboard.read'] });
  const adminUser = await User.create({ name: 'Admin Quotation', email: 'quotation-admin@test.invalid', passwordHash: await hashPassword('quotation-admin-password'), role: adminRole._id });
  await User.create({ name: 'Limited Quotation', email: 'quotation-limited@test.invalid', passwordHash: await hashPassword('quotation-limited-password'), role: limitedRole._id });
  const category = await Category.create({ name: 'Prueba cotización' });
  const customer = await Client.create({ name: 'Cliente Quotation', email: 'customer-quotation@test.invalid' });
  const product = await Product.create({ code: 'QUO-P-1', name: 'Producto Cotizable', categoryId: category.id, purchasePrice: 50, salePrice: 100, minStock: 0 });
  const warehouse = await Warehouse.create({ name: 'Almacén Quotation' });
  await InventoryStock.create({ productId: product.id, warehouseId: warehouse.id, quantity: 10, reservedQuantity: 0, minimumStock: 0 });
  const adminLogin = await request(app).post('/api/auth/login').send({ email: adminUser.email, password: 'quotation-admin-password' });
  const limitedLogin = await request(app).post('/api/auth/login').send({ email: 'quotation-limited@test.invalid', password: 'quotation-limited-password' });
  const admin = adminLogin.body.data.token;
  const limited = limitedLogin.body.data.token;
  const auth = { Authorization: `Bearer ${admin}` };
  const quoteUrl = '/api/sales/quotations';
  const body = {
    customerId: customer.id,
    status: 'converted', subtotal: 0, taxes: 0, total: 0, saleId: new mongoose.Types.ObjectId(),
    items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 2, unitPrice: 100, taxRate: 16, subtotal: 0, tax: 0, total: 0 }]
  };

  const stockBefore = await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id });
  const movementCountBefore = await InventoryMovement.countDocuments();
  const receivableCountBefore = await AccountsReceivable.countDocuments();
  const created = await request(app).post(quoteUrl).set(auth).send(body);
  assert.equal(created.status, 201, 'QUO-001 crear cotización persistente');
  const quotationId = created.body.data.id;
  assert.match(created.body.data.folio, /^COT-\d{4}-\d{6}$/);
  assert.equal(created.body.data.status, 'draft');
  assert.equal(created.body.data.subtotal, 200, 'QUO-002 subtotal calculado en servidor');
  assert.equal(created.body.data.taxes, 32);
  assert.equal(created.body.data.total, 232);
  assert.equal(created.body.data.items[0].productNameSnapshot, 'Producto Cotizable');
  assert.equal(created.body.data.items[0].skuSnapshot, 'QUO-P-1');
  assert.equal(String((await Quotation.findById(quotationId)).createdBy), String(adminUser.id));
  assert.equal((await InventoryStock.findById(stockBefore.id)).quantity, 10, 'crear cotización no toca stock');
  assert.equal(await InventoryMovement.countDocuments(), movementCountBefore);
  assert.equal(await AccountsReceivable.countDocuments(), receivableCountBefore);

  assert.equal((await request(app).post(quoteUrl).set(auth).send({ ...body, customerId: new mongoose.Types.ObjectId() })).status, 404, 'QUO-003 cliente inexistente');
  assert.equal((await request(app).post(quoteUrl).set(auth).send({ ...body, items: [{ ...body.items[0], productId: new mongoose.Types.ObjectId() }] })).status, 404, 'QUO-004 producto inexistente');
  assert.equal((await request(app).post(quoteUrl).set(auth).send({ ...body, items: [{ ...body.items[0], quantity: 0 }] })).status, 400, 'cantidad inválida');

  const list = await request(app).get(`${quoteUrl}?search=${created.body.data.folio}&status=draft&page=1&limit=10&sort=folio&order=asc`).set(auth);
  assert.equal(list.status, 200, 'QUO-005 listado con búsqueda, filtros y paginación');
  assert.equal(list.body.data[0].id, quotationId);
  assert.equal(list.body.pagination.total, 1);
  assert.equal(list.body.pagination.page, 1);
  const detail = await request(app).get(`${quoteUrl}/${quotationId}`).set(auth);
  assert.equal(detail.status, 200, 'QUO-006 detalle');
  assert.equal(detail.body.data.customer.name, customer.name);
  assert.equal((await request(app).get(`${quoteUrl}/${new mongoose.Types.ObjectId()}`).set(auth)).status, 404, 'cotización inexistente devuelve 404');

  const updated = await request(app).put(`${quoteUrl}/${quotationId}`).set(auth).send({ ...body, items: [{ ...body.items[0], quantity: 1, unitPrice: 110, taxRate: 8 }] });
  assert.equal(updated.status, 200, 'QUO-007 editar draft');
  assert.equal(updated.body.data.total, 118.8, 'edición recalcula importes en servidor');
  assert.equal(updated.body.data.subtotal, 110);
  assert.equal(updated.body.data.taxes, 8.8);

  const sent = await request(app).post(`${quoteUrl}/${quotationId}/send`).set(auth).send();
  assert.equal(sent.status, 200, 'QUO-009 enviar');
  assert.equal(sent.body.data.status, 'sent');
  assert.ok(sent.body.data.sentAt);
  assert.equal((await request(app).put(`${quoteUrl}/${quotationId}`).set(auth).send(body)).status, 409, 'QUO-008 solo draft se edita');
  const accepted = await request(app).post(`${quoteUrl}/${quotationId}/accept`).set(auth).send();
  assert.equal(accepted.status, 200, 'QUO-010 aceptar');
  assert.equal(accepted.body.data.status, 'accepted');
  assert.ok(accepted.body.data.acceptedAt);
  assert.equal((await request(app).put(`${quoteUrl}/${quotationId}`).set(auth).send(body)).status, 409, 'QUO-008 una cotización accepted es inmutable');
  assert.equal((await request(app).post(`${quoteUrl}/${quotationId}/reject`).set(auth).send()).status, 409, 'estado terminal/transición inválida controlada');

  const quotationForRejection = await request(app).post(quoteUrl).set(auth).send(body);
  const rejectedId = quotationForRejection.body.data.id;
  assert.equal((await request(app).post(`${quoteUrl}/${rejectedId}/send`).set(auth).send()).status, 200);
  const rejected = await request(app).post(`${quoteUrl}/${rejectedId}/reject`).set(auth).send();
  assert.equal(rejected.status, 200, 'QUO-011 rechazar');
  assert.equal(rejected.body.data.status, 'rejected');
  assert.ok(rejected.body.data.rejectedAt);
  assert.equal((await request(app).post(`${quoteUrl}/${rejectedId}/convert`).set(auth).send()).status, 409, 'rejected no se convierte');

  const quotationForCancel = await request(app).post(quoteUrl).set(auth).send(body);
  const cancelled = await request(app).post(`${quoteUrl}/${quotationForCancel.body.data.id}/cancel`).set(auth).send();
  assert.equal(cancelled.status, 200, 'QUO-012 cancelar');
  assert.equal(cancelled.body.data.status, 'cancelled');
  assert.ok(cancelled.body.data.cancelledAt);
  assert.equal((await request(app).post(`${quoteUrl}/${quotationForCancel.body.data.id}/convert`).set(auth).send()).status, 409);

  const stockBeforeConversion = (await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id })).quantity;
  const movesBeforeConversion = await InventoryMovement.countDocuments();
  const receivablesBeforeConversion = await AccountsReceivable.countDocuments();
  const financialMovementsBeforeConversion = await FinancialMovement.countDocuments();
  const converted = await request(app).post(`${quoteUrl}/${quotationId}/convert`).set(auth).send();
  assert.equal(converted.status, 201, 'QUO-013 convertir accepted');
  assert.equal(converted.body.data.quotation.status, 'converted');
  assert.equal(String(converted.body.data.quotation.saleId), converted.body.data.sale.id);
  assert.ok(converted.body.data.quotation.convertedAt);
  assert.match(converted.body.data.sale.folio, /^VEN-\d{4}-\d{6}$/);
  assert.equal(converted.body.data.sale.status, 'draft', 'QUO-014 venta creada como draft');
  assert.equal(converted.body.data.sale.total, 118.8);
  assert.equal(converted.body.data.sale.items[0].unitPrice, 110);
  assert.equal((await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id })).quantity, stockBeforeConversion, 'QUO-015 conversión no cambia existencias');
  assert.equal(await InventoryMovement.countDocuments(), movesBeforeConversion);
  assert.equal(await AccountsReceivable.countDocuments(), receivablesBeforeConversion, 'QUO-016 conversión no crea CxC');
  assert.equal(await FinancialMovement.countDocuments(), financialMovementsBeforeConversion, 'convertir no genera movimientos financieros');
  assert.equal((await Sale.findById(converted.body.data.sale.id)).status, 'draft');
  assert.equal((await request(app).post(`${quoteUrl}/${quotationId}/cancel`).set(auth).send()).status, 409, 'converted no puede cancelarse');
  assert.equal((await request(app).post(`${quoteUrl}/${quotationId}/convert`).set(auth).send()).status, 409, 'doble conversión devuelve 409');

  const concurrentQuote = await request(app).post(quoteUrl).set(auth).send(body);
  const concurrentId = concurrentQuote.body.data.id;
  await request(app).post(`${quoteUrl}/${concurrentId}/send`).set(auth).send();
  await request(app).post(`${quoteUrl}/${concurrentId}/accept`).set(auth).send();
  const conversions = await Promise.all([
    request(app).post(`${quoteUrl}/${concurrentId}/convert`).set(auth).send(),
    request(app).post(`${quoteUrl}/${concurrentId}/convert`).set(auth).send()
  ]);
  assert.deepEqual(conversions.map(response => response.status).sort((a, b) => a - b), [201, 409], 'QUO-017 doble conversión concurrente protegida');
  assert.equal(await Sale.countDocuments({ _id: { $in: conversions.filter(item => item.status === 201).map(item => item.body.data.sale.id) } }), 1);

  const rollbackQuote = await request(app).post(quoteUrl).set(auth).send(body);
  const rollbackId = rollbackQuote.body.data.id;
  await request(app).post(`${quoteUrl}/${rollbackId}/send`).set(auth).send();
  await request(app).post(`${quoteUrl}/${rollbackId}/accept`).set(auth).send();
  const salesBeforeRollback = await Sale.countDocuments();
  const auditBeforeRollback = await AuditLog.countDocuments({ action: 'quotation.convert' });
  const originalAuditCreate = AuditLog.create;
  AuditLog.create = async function failQuotationConversionAudit(documents, ...args) {
    const entry = Array.isArray(documents) ? documents[0] : documents;
    if (entry?.action === 'quotation.convert') throw new Error('QUO-018 simulated audit failure');
    return originalAuditCreate.call(this, documents, ...args);
  };
  let rollbackResponse;
  try { rollbackResponse = await request(app).post(`${quoteUrl}/${rollbackId}/convert`).set(auth).send(); }
  finally { AuditLog.create = originalAuditCreate; }
  assert.equal(rollbackResponse.status, 500, 'QUO-018 el fallo intermedio se reporta controladamente');
  const rolledBackQuote = await Quotation.findById(rollbackId);
  assert.equal(rolledBackQuote.status, 'accepted');
  assert.equal(rolledBackQuote.saleId, null);
  assert.equal(await Sale.countDocuments(), salesBeforeRollback, 'rollback no deja venta parcial');
  assert.equal(await AuditLog.countDocuments({ action: 'quotation.convert' }), auditBeforeRollback);
  assert.equal((await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id })).quantity, stockBeforeConversion);

  assert.equal((await request(app).get(quoteUrl).set('Authorization', `Bearer ${limited}`)).status, 403, 'QUO-019 RBAC deniega lectura');
  assert.equal((await request(app).post(quoteUrl).set('Authorization', `Bearer ${limited}`).send(body)).status, 403, 'RBAC deniega escritura');

  const quotationAudits = await AuditLog.find({ module: 'sales', recordId: quotationId }).lean();
  const actions = new Set(quotationAudits.map(entry => entry.action));
  for (const action of ['quotation.create', 'quotation.update', 'quotation.send', 'quotation.accept', 'quotation.convert']) assert.ok(actions.has(action), `QUO-020 auditoría incluye ${action}`);

  const confirmed = await request(app).post(`/api/sales/${converted.body.data.sale.id}/confirm`).set(auth).send();
  assert.equal(confirmed.status, 200, 'la venta convertida confirma con el flujo normal');
  assert.equal(confirmed.body.data.status, 'confirmed');
  assert.equal((await InventoryStock.findOne({ productId: product.id, warehouseId: warehouse.id })).quantity, stockBeforeConversion - 1);
  assert.equal(await AccountsReceivable.countDocuments(), receivablesBeforeConversion + 1, 'CxC se crea solo después de confirmar la venta');
});
