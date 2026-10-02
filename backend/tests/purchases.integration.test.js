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
  isolated.pathname = `/ept_${process.pid}_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  process.env.MONGODB_URI = isolated.toString();
}
const app = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Role = require('../src/models/Role');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const InventoryStock = require('../src/models/InventoryStock');
const InventoryMovement = require('../src/models/InventoryMovement');
const Purchase = require('../src/models/Purchase');
const Sequence = require('../src/models/Sequence');
const { Category, Product, Supplier, Warehouse } = require('../src/models/catalog');
const { PERMISSIONS } = require('../src/services/permissions');
const { hashPassword } = require('../src/services/authService');

test('MongoDB integration: persistent purchase workflow and transactional receiving', {
  skip: testUri ? false : 'Define TEST_MONGODB_URI con una instancia desechable de MongoDB compatible con transacciones'
}, async t => {
  await connectDatabase();
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
  t.after(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });

  const role = await Role.create({ name: `purchases-admin-${process.pid}`, permissions: PERMISSIONS });
  const user = await User.create({ name: 'Admin compras', email: `purchases-${process.pid}@test.invalid`, passwordHash: await hashPassword('clave-compras-prueba-larga'), role: role._id });
  const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'clave-compras-prueba-larga' });
  assert.equal(login.status, 200);
  const admin = login.body.data.token;
  const category = await Category.create({ name: `Accesorios-${process.pid}` });
  const productA = await Product.create({ code: `PUR-A-${process.pid}`, name: 'Producto Compra A', categoryId: category.id, purchasePrice: 12, salePrice: 20, minStock: 2 });
  const productB = await Product.create({ code: `PUR-B-${process.pid}`, name: 'Producto Compra B', categoryId: category.id, purchasePrice: 7, salePrice: 15, minStock: 1 });
  const supplier = await Supplier.create({ name: 'Proveedor de prueba' });
  const warehouse = await Warehouse.create({ name: `Almacén Compras-${process.pid}` });
  await InventoryStock.create({ productId: productB.id, warehouseId: warehouse.id, quantity: 8, reservedQuantity: 3, minimumStock: 1 });
  const route = '/api/purchases';
  const body = items => ({ supplierId: supplier.id, items });
  const lines = [
    { productId: productA.id, warehouseId: warehouse.id, quantity: 5, unitCost: 11, taxRate: 16 },
    { productId: productB.id, warehouseId: warehouse.id, quantity: 3, unitCost: 7, taxRate: 0 }
  ];

  const created = await request(app).post(route).set('Authorization', `Bearer ${admin}`).send(body(lines));
  assert.equal(created.status, 201, 'COM-001: crea una compra en borrador');
  assert.match(created.body.data.folio, /^COM-\d{4}-\d{6}$/);
  assert.equal(created.body.data.status, 'draft');
  assert.equal(created.body.data.subtotal, 76);
  assert.equal(created.body.data.taxes, 8.8);
  assert.equal(created.body.data.total, 84.8);
  assert.equal((await InventoryStock.findOne({ productId: productB.id, warehouseId: warehouse.id })).quantity, 8, 'el borrador no modifica inventario');

  const listed = await request(app).get(`${route}?search=${created.body.data.folio}&status=draft&page=1&limit=10`).set('Authorization', `Bearer ${admin}`);
  assert.equal(listed.status, 200, 'COM-002: listado persistente, búsqueda y filtros');
  assert.equal(listed.body.data[0].id, created.body.data.id);
  assert.equal(listed.body.pagination.total, 1);
  assert.equal((await request(app).get(`${route}/${created.body.data.id}`).set('Authorization', `Bearer ${admin}`)).status, 200);

  const missingSupplier = await request(app).post(route).set('Authorization', `Bearer ${admin}`).send({ items: [lines[0]] });
  assert.equal(missingSupplier.status, 400);
  const invalidQuantity = await request(app).post(route).set('Authorization', `Bearer ${admin}`).send(body([{ ...lines[0], quantity: 0 }]));
  assert.equal(invalidQuantity.status, 400);
  const duplicateIds = await Promise.all(Array.from({ length: 5 }, () => request(app).post(route).set('Authorization', `Bearer ${admin}`).send(body([{ ...lines[0], quantity: 1 }]))));
  assert.ok(duplicateIds.every(response => response.status === 201), 'los folios se reservan sin colisiones');
  const folios = [created.body.data.folio, ...duplicateIds.map(response => response.body.data.folio)];
  assert.equal(new Set(folios).size, folios.length, 'COM-014: folio único bajo concurrencia');
  assert.equal((await Sequence.findOne({ _id: `purchase:${new Date().getUTCFullYear()}` })).value, 6);

  const purchaseId = created.body.data.id;
  const ordered = await request(app).post(`${route}/${purchaseId}/order`).set('Authorization', `Bearer ${admin}`).send({});
  assert.equal(ordered.status, 200, 'COM-003: ordena la compra');
  assert.equal(ordered.body.data.status, 'ordered');
  assert.equal((await InventoryStock.findOne({ productId: productB.id, warehouseId: warehouse.id })).quantity, 8, 'ordenar no afecta existencias');
  const invalidUpdate = await request(app).put(`${route}/${purchaseId}`).set('Authorization', `Bearer ${admin}`).send({ items: lines });
  assert.equal(invalidUpdate.status, 409, 'una compra ordenada no se edita');

  const received = await request(app).post(`${route}/${purchaseId}/receive`).set('Authorization', `Bearer ${admin}`).send({});
  assert.equal(received.status, 200, 'COM-004: recibe la compra');
  assert.equal(received.body.data.status, 'received');
  assert.ok(received.body.data.receivedAt);
  const stockA = await InventoryStock.findOne({ productId: productA.id, warehouseId: warehouse.id });
  const stockB = await InventoryStock.findOne({ productId: productB.id, warehouseId: warehouse.id });
  assert.equal(stockA.quantity, 5, 'COM-005: crea stock de almacén al recibir');
  assert.equal(stockA.reservedQuantity, 0);
  assert.equal(stockB.quantity, 11);
  assert.equal(stockB.reservedQuantity, 3, 'la recepción conserva el inventario reservado');
  const movements = await InventoryMovement.find({ referenceType: 'purchase', referenceId: purchaseId }).sort({ productId: 1 });
  assert.equal(movements.length, 2, 'COM-006: movimiento PURCHASE por partida');
  assert.ok(movements.every(item => item.type === 'PURCHASE' && item.userId.equals(user._id)));
  const duplicateReceive = await request(app).post(`${route}/${purchaseId}/receive`).set('Authorization', `Bearer ${admin}`).send({});
  assert.equal(duplicateReceive.status, 409, 'COM-007: recepción duplicada rechazada');
  assert.equal((await InventoryStock.findOne({ productId: productA.id, warehouseId: warehouse.id })).quantity, 5);
  const cancelReceived = await request(app).post(`${route}/${purchaseId}/cancel`).set('Authorization', `Bearer ${admin}`).send({});
  assert.equal(cancelReceived.status, 409, 'COM-011: no revierte recepción de forma silenciosa');

  await Product.updateOne({ _id: productA.id }, { $set: { name: 'Nombre posterior' } });
  const detailAfterRename = await request(app).get(`${route}/${purchaseId}`).set('Authorization', `Bearer ${admin}`);
  assert.equal(detailAfterRename.body.data.items[0].productNameSnapshot, 'Producto Compra A', 'COM-015: conserva snapshots');

  const cancelDraft = await request(app).post(`${route}/${duplicateIds[0].body.data.id}/cancel`).set('Authorization', `Bearer ${admin}`).send({});
  assert.equal(cancelDraft.status, 200, 'COM-009: cancela borrador');
  const cancelOrderedDraft = await request(app).post(`${route}/${duplicateIds[1].body.data.id}/order`).set('Authorization', `Bearer ${admin}`).send({});
  assert.equal(cancelOrderedDraft.status, 200);
  const cancelOrdered = await request(app).post(`${route}/${duplicateIds[1].body.data.id}/cancel`).set('Authorization', `Bearer ${admin}`).send({});
  assert.equal(cancelOrdered.status, 200, 'COM-010: cancela orden no recibida');
  const invalidTransition = await request(app).post(`${route}/${duplicateIds[0].body.data.id}/receive`).set('Authorization', `Bearer ${admin}`).send({});
  assert.equal(invalidTransition.status, 409, 'COM-012: transición inválida controlada');
  const missing = await request(app).get(`${route}/${new mongoose.Types.ObjectId()}`).set('Authorization', `Bearer ${admin}`);
  assert.equal(missing.status, 404);

  const limitedRole = await Role.create({ name: `purchases-read-${process.pid}`, permissions: ['purchases.read'] });
  const limitedUser = await User.create({ name: 'Lector compras', email: `purchases-reader-${process.pid}@test.invalid`, passwordHash: await hashPassword('clave-lector-compras-larga'), role: limitedRole.id });
  const limitedLogin = await request(app).post('/api/auth/login').send({ email: limitedUser.email, password: 'clave-lector-compras-larga' });
  const forbidden = await request(app).post(`${route}/${purchaseId}/receive`).set('Authorization', `Bearer ${limitedLogin.body.data.token}`).send({});
  assert.equal(forbidden.status, 403, 'COM-013: RBAC de recepción en backend');

  const concurrentPurchase = await request(app).post(route).set('Authorization', `Bearer ${admin}`).send(body([{ ...lines[0], quantity: 4 }]));
  assert.equal(concurrentPurchase.status, 201);
  await request(app).post(`${route}/${concurrentPurchase.body.data.id}/order`).set('Authorization', `Bearer ${admin}`).send({});
  const concurrentResults = await Promise.all(Array.from({ length: 2 }, () => request(app).post(`${route}/${concurrentPurchase.body.data.id}/receive`).set('Authorization', `Bearer ${admin}`).send({})));
  assert.equal(concurrentResults.filter(response => response.status === 200).length, 1, 'COM-016: solo una recepción concurrente gana');
  assert.equal(concurrentResults.filter(response => response.status === 409).length, 1);
  assert.equal((await InventoryStock.findOne({ productId: productA.id, warehouseId: warehouse.id })).quantity, 9, 'el stock solo se incrementa una vez');
  assert.equal(await InventoryMovement.countDocuments({ referenceType: 'purchase', referenceId: concurrentPurchase.body.data.id }), 1);

  const rollbackPurchase = await request(app).post(route).set('Authorization', `Bearer ${admin}`).send(body([
    { ...lines[0], quantity: 2 }, { ...lines[1], quantity: 2 }
  ]));
  await request(app).post(`${route}/${rollbackPurchase.body.data.id}/order`).set('Authorization', `Bearer ${admin}`).send({});
  const stockBeforeRollback = await InventoryStock.findOne({ productId: productA.id, warehouseId: warehouse.id });
  const stockBBeforeRollback = await InventoryStock.findOne({ productId: productB.id, warehouseId: warehouse.id });
  const purchaseMovementsBefore = await InventoryMovement.countDocuments({ type: 'PURCHASE' });
  const purchaseAuditsBefore = await AuditLog.countDocuments({ module: { $in: ['purchases', 'inventory'] } });
  const originalCreate = InventoryMovement.create;
  let purchaseMovementAttempts = 0;
  InventoryMovement.create = function failSecondPurchaseMovement(...args) {
    const docs = Array.isArray(args[0]) ? args[0] : [args[0]];
    if (docs[0]?.type === 'PURCHASE' && ++purchaseMovementAttempts === 2) throw new Error('COM-008 simulated movement failure');
    return originalCreate.apply(this, args);
  };
  let rollbackResponse;
  try { rollbackResponse = await request(app).post(`${route}/${rollbackPurchase.body.data.id}/receive`).set('Authorization', `Bearer ${admin}`).send({}); }
  finally { InventoryMovement.create = originalCreate; }
  assert.equal(rollbackResponse.status, 500, 'COM-008: error controlado y transacción revertida');
  assert.equal((await InventoryStock.findOne({ productId: productA.id, warehouseId: warehouse.id })).quantity, stockBeforeRollback.quantity);
  assert.equal((await InventoryStock.findOne({ productId: productB.id, warehouseId: warehouse.id })).quantity, stockBBeforeRollback.quantity);
  assert.equal((await Purchase.findById(rollbackPurchase.body.data.id)).status, 'ordered');
  assert.equal(await InventoryMovement.countDocuments({ type: 'PURCHASE' }), purchaseMovementsBefore);
  assert.equal(await AuditLog.countDocuments({ module: { $in: ['purchases', 'inventory'] } }), purchaseAuditsBefore);

  const purchaseLogs = await AuditLog.find({ module: 'purchases' }).lean();
  const inventoryLogs = await AuditLog.find({ module: 'inventory', action: 'inventory.purchase' }).lean();
  assert.ok(purchaseLogs.some(item => item.action === 'purchase.created'));
  assert.ok(purchaseLogs.some(item => item.action === 'purchase.ordered'));
  assert.ok(purchaseLogs.some(item => item.action === 'purchase.received'));
  assert.ok(purchaseLogs.some(item => item.action === 'purchase.cancelled'));
  assert.ok(inventoryLogs.length >= 2);
});
