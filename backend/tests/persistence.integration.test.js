require('dotenv').config();
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const testUri = process.env.TEST_MONGODB_URI;
if (testUri) {
  const isolated = new URL(testUri);
  isolated.pathname = `/erp_test_${process.pid}_${Date.now()}`;
  process.env.MONGODB_URI = isolated.toString();
}
const app = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Role = require('../src/models/Role');
const User = require('../src/models/User');
const { PERMISSIONS } = require('../src/services/permissions');
const { hashPassword } = require('../src/services/authService');
const { ensureInitialAdmin } = require('../src/services/bootstrapService');
const emailService = require('../src/services/emailService');
const AuditLog = require('../src/models/AuditLog');
const InventoryStock = require('../src/models/InventoryStock');
const InventoryMovement = require('../src/models/InventoryMovement');
const Sale = require('../src/models/Sale');

test('MongoDB integration: auth, RBAC, uniqueness, catalogs and audit', {
  skip: testUri ? false : 'Define TEST_MONGODB_URI con una instancia desechable de MongoDB compatible con transacciones'
}, async t => {
  const sentEmails = [];
  let failEmailDelivery = false;
  emailService.setTestClient({ emails: { send: async (payload, options) => {
    if (failEmailDelivery) throw new Error('private provider failure detail');
    sentEmails.push({ payload, options });
    return { data: { id: `test-${sentEmails.length}` } };
  } } });
  await connectDatabase();
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
  t.after(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });

  const adminRole = await Role.create({ name: 'admin-test', permissions: PERMISSIONS });
  const managerRole = await Role.create({ name: 'manager-test', permissions: ['dashboard.read'] });
  await User.create({ name: 'Admin de prueba', email: 'admin@test.invalid', passwordHash: await hashPassword('clave-de-prueba-muy-larga'), role: adminRole._id });

  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);

  const bootstrapEnv = {
    INITIAL_ADMIN_NAME: 'Admin Bootstrap',
    INITIAL_ADMIN_EMAIL: 'bootstrap@test.invalid',
    INITIAL_ADMIN_PASSWORD: 'clave-bootstrap-larga-2026'
  };
  assert.deepEqual(await ensureInitialAdmin(bootstrapEnv), { created: true });
  assert.deepEqual(await ensureInitialAdmin({}), { created: false });
  const bootstrapLogin = await request(app).post('/api/auth/login').send({ email: bootstrapEnv.INITIAL_ADMIN_EMAIL, password: bootstrapEnv.INITIAL_ADMIN_PASSWORD });
  assert.equal(bootstrapLogin.status, 200);
  assert.equal(bootstrapLogin.body.data.user.role, 'admin');
  assert.equal(bootstrapLogin.body.data.user.permissions.includes('users.create'), true);

  const login = await request(app).post('/api/auth/login').send({ email: 'admin@test.invalid', password: 'clave-de-prueba-muy-larga' });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.permissions.includes('users.create'), true);
  const admin = login.body.data.token;

  const createdUser = await request(app).post('/api/users').set('Authorization', `Bearer ${admin}`).send({ name: 'Operador', email: 'operator@test.invalid', password: 'clave-operador-larga', role: managerRole.id });
  assert.equal(createdUser.status, 201);
  assert.equal(createdUser.body.data.permissions.includes('users.create'), false);
  assert.equal(createdUser.body.data.emailVerification, 'sent');
  assert.equal(createdUser.body.data.emailVerified, false);
  const verificationEmail = sentEmails.at(-1);
  const operatorToken = verificationEmail.payload.html.match(/verify-email\?token=([A-Za-z0-9_-]+)/)?.[1];
  assert.ok(operatorToken);
  const operatorStored = await User.findOne({ email: 'operator@test.invalid' }).select('+emailVerificationTokenHash +emailVerificationExpiresAt');
  assert.ok(operatorStored.emailVerificationTokenHash);
  assert.notEqual(operatorStored.emailVerificationTokenHash, operatorToken);
  assert.equal(operatorStored.emailVerificationExpiresAt > new Date(), true);

  const duplicate = await request(app).post('/api/users').set('Authorization', `Bearer ${admin}`).send({ name: 'Duplicado', email: 'operator@test.invalid', password: 'clave-operador-larga', role: managerRole.id });
  assert.equal(duplicate.status, 409);

  const operatorLogin = await request(app).post('/api/auth/login').send({ email: 'operator@test.invalid', password: 'clave-operador-larga' });
  assert.equal(operatorLogin.status, 403);
  assert.equal(operatorLogin.body.error, 'EMAIL_NOT_VERIFIED');
  const verified = await request(app).post('/api/auth/verify-email').send({ token: operatorToken });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.data.emailVerified, true);
  assert.equal(sentEmails.at(-1).payload.subject, 'Bienvenido al ERP');
  const reusedToken = await request(app).post('/api/auth/verify-email').send({ token: operatorToken });
  assert.equal(reusedToken.status, 400);
  const invalidToken = await request(app).post('/api/auth/verify-email').send({ token: 'invalid-token' });
  assert.equal(invalidToken.status, 400);
  assert.equal((await request(app).post('/api/auth/resend-verification').send({ email: 'missing@test.invalid' })).status, 200);
  const sendsAfterVerifiedResend = sentEmails.length;
  await request(app).post('/api/auth/resend-verification').send({ email: 'operator@test.invalid' });
  assert.equal(sentEmails.length, sendsAfterVerifiedResend);
  assert.equal(sentEmails.filter(email => email.payload.subject === 'Bienvenido al ERP').length, 1);
  assert.equal((await request(app).post('/api/auth/login').send({ email: 'operator@test.invalid', password: 'clave-operador-larga' })).status, 200);
  // The pre-verification response did not issue a token; use the verified session for RBAC checks.
  const verifiedOperatorLogin = await request(app).post('/api/auth/login').send({ email: 'operator@test.invalid', password: 'clave-operador-larga' });
  assert.equal((await request(app).get('/api/users').set('Authorization', `Bearer ${verifiedOperatorLogin.body.data.token}`)).status, 403);
  const forbiddenUserCreation = await request(app).post('/api/users').set('Authorization', `Bearer ${verifiedOperatorLogin.body.data.token}`).send({ name: 'Escalado', email: 'escalated@test.invalid', password: 'clave-operador-larga', role: 'admin-test' });
  assert.equal(forbiddenUserCreation.status, 403);

  failEmailDelivery = true;
  const mailFailureUser = await request(app).post('/api/users').set('Authorization', `Bearer ${admin}`).send({ name: 'Correo Pendiente', email: 'mail-failure@test.invalid', password: 'clave-correo-larga', role: managerRole.id });
  assert.equal(mailFailureUser.status, 201);
  assert.equal(mailFailureUser.body.data.emailVerification, 'pending');
  const pendingUser = await User.findOne({ email: 'mail-failure@test.invalid' }).select('+emailVerificationTokenHash');
  const originalPendingHash = pendingUser.emailVerificationTokenHash;
  assert.ok(pendingUser);
  failEmailDelivery = false;
  const resend = await request(app).post('/api/auth/resend-verification').send({ email: 'mail-failure@test.invalid' });
  assert.equal(resend.status, 200);
  const refreshedPending = await User.findById(pendingUser.id).select('+emailVerificationTokenHash');
  assert.notEqual(refreshedPending.emailVerificationTokenHash, originalPendingHash);
  const resentToken = sentEmails.at(-1).payload.html.match(/verify-email\?token=([A-Za-z0-9_-]+)/)?.[1];
  assert.ok(resentToken);
  assert.equal((await request(app).post('/api/auth/verify-email').send({ token: resentToken })).status, 200);

  const expiredUser = await request(app).post('/api/users').set('Authorization', `Bearer ${admin}`).send({ name: 'Enlace Expirado', email: 'expired@test.invalid', password: 'clave-expirada-larga', role: managerRole.id });
  assert.equal(expiredUser.status, 201);
  const expiredToken = sentEmails.at(-1).payload.html.match(/verify-email\?token=([A-Za-z0-9_-]+)/)?.[1];
  await User.updateOne({ email: 'expired@test.invalid' }, { $set: { emailVerificationExpiresAt: new Date(Date.now() - 1000) } });
  const expiredAttempt = await request(app).post('/api/auth/verify-email').send({ token: expiredToken });
  assert.equal(expiredAttempt.status, 400);
  assert.equal(expiredAttempt.body.error, 'VERIFICATION_TOKEN_EXPIRED');

  const resendAttempts = await Promise.all(Array.from({ length: 3 }, () => request(app).post('/api/auth/resend-verification').send({ email: 'expired@test.invalid' })));
  assert.equal(resendAttempts.at(-1).status, 429);

  const roleUpdate = await request(app).put(`/api/roles/${managerRole.id}`).set('Authorization', `Bearer ${admin}`).send({ permissions: ['dashboard.read', 'users.read'] });
  assert.equal(roleUpdate.status, 200);
  const refreshedRoleAccess = await request(app).get('/api/users').set('Authorization', `Bearer ${verifiedOperatorLogin.body.data.token}`);
  assert.equal(refreshedRoleAccess.status, 200);

  const badRole = await request(app).post('/api/roles').set('Authorization', `Bearer ${admin}`).send({ name: 'invalid', permissions: ['system.superuser'] });
  assert.equal(badRole.status, 400);

  const client = await request(app).post('/api/clients').set('Authorization', `Bearer ${admin}`).send({ name: 'Cliente Uno', email: 'client@test.invalid' });
  assert.equal(client.status, 201);
  const duplicateClient = await request(app).post('/api/clients').set('Authorization', `Bearer ${admin}`).send({ name: 'Cliente Duplicado', email: 'client@test.invalid' });
  assert.equal(duplicateClient.status, 409);
  const supplier = await request(app).post('/api/suppliers').set('Authorization', `Bearer ${admin}`).send({ name: 'Proveedor Uno', email: 'supplier@test.invalid' });
  assert.equal(supplier.status, 201);
  const warehouse = await request(app).post('/api/warehouses').set('Authorization', `Bearer ${admin}`).send({ name: 'Almacén Uno' });
  assert.equal(warehouse.status, 201);
  const secondWarehouse = await request(app).post('/api/warehouses').set('Authorization', `Bearer ${admin}`).send({ name: 'Almacén Dos' });
  assert.equal(secondWarehouse.status, 201);

  const category = await request(app).post('/api/categories').set('Authorization', `Bearer ${admin}`).send({ name: 'Herramientas' });
  assert.equal(category.status, 201);
  const categoryDuplicate = await request(app).post('/api/categories').set('Authorization', `Bearer ${admin}`).send({ name: 'herramientas' });
  assert.equal(categoryDuplicate.status, 409);
  const product = await request(app).post('/api/products').set('Authorization', `Bearer ${admin}`).send({ code: 'HER-1', name: 'Martillo', categoryId: category.body.data.id, purchasePrice: 10, salePrice: 15 });
  assert.equal(product.status, 201);
  const invalidProduct = await request(app).post('/api/products').set('Authorization', `Bearer ${admin}`).send({ code: 'HER-2', name: 'Martillo', categoryId: category.body.data.id, purchasePrice: 15, salePrice: 10 });
  assert.equal(invalidProduct.status, 400);
  const duplicateProduct = await request(app).post('/api/products').set('Authorization', `Bearer ${admin}`).send({ code: 'HER-1', name: 'Otro martillo', categoryId: category.body.data.id, purchasePrice: 9, salePrice: 16 });
  assert.equal(duplicateProduct.status, 409);
  const productPage = await request(app).get('/api/products?search=martillo&limit=1&page=1').set('Authorization', `Bearer ${admin}`);
  assert.equal(productPage.body.pagination.total, 1);

  const inventoryRoute = '/api/inventory';
  const productId = product.body.data.id;
  const warehouseId = warehouse.body.data.id;
  const secondWarehouseId = secondWarehouse.body.data.id;
  const unauthorizedStockRead = await request(app).get(inventoryRoute).set('Authorization', `Bearer ${verifiedOperatorLogin.body.data.token}`);
  assert.equal(unauthorizedStockRead.status, 403, 'INV-007: inventario requiere permiso');
  const unauthorizedEntry = await request(app).post(`${inventoryRoute}/entry`).set('Authorization', `Bearer ${verifiedOperatorLogin.body.data.token}`).send({ productId, warehouseId, quantity: 1, reason: 'Sin permiso' });
  assert.equal(unauthorizedEntry.status, 403, 'INV-007: movimiento requiere permiso');

  const entry = await request(app).post(`${inventoryRoute}/entry`).set('Authorization', `Bearer ${admin}`).send({ productId, warehouseId, quantity: 15, reason: 'Recepción inicial', userId: new mongoose.Types.ObjectId().toString() });
  assert.equal(entry.status, 201, 'INV-001: entrada persiste y suma existencias');
  assert.equal(entry.body.data.stock.quantity, 15);
  assert.equal(entry.body.data.movement.type, 'IN');
  assert.equal(entry.body.data.movement.userId, login.body.data.user.id, 'el actor sale del JWT, no del body');

  const exit = await request(app).post(`${inventoryRoute}/exit`).set('Authorization', `Bearer ${admin}`).send({ productId, warehouseId, quantity: 4, reason: 'Salida de prueba' });
  assert.equal(exit.status, 201, 'INV-002: salida reduce existencias');
  assert.equal(exit.body.data.stock.quantity, 11);
  const movementCountBeforeRejectedExit = await InventoryMovement.countDocuments();
  const excessiveExit = await request(app).post(`${inventoryRoute}/exit`).set('Authorization', `Bearer ${admin}`).send({ productId, warehouseId, quantity: 12, reason: 'Salida excedente' });
  assert.equal(excessiveExit.status, 409, 'INV-003: salida mayor al stock se rechaza');
  assert.equal(excessiveExit.body.error, 'INSUFFICIENT_STOCK');
  assert.equal(await InventoryMovement.countDocuments(), movementCountBeforeRejectedExit, 'la salida rechazada no deja movimiento parcial');
  assert.equal((await InventoryStock.findOne({ productId, warehouseId })).quantity, 11);

  const adjustment = await request(app).post(`${inventoryRoute}/adjust`).set('Authorization', `Bearer ${admin}`).send({ productId, warehouseId, newQuantity: 8, reason: 'Conteo físico' });
  assert.equal(adjustment.status, 201, 'INV-004: ajuste establece existencia contada');
  assert.equal(adjustment.body.data.movement.type, 'ADJUSTMENT');
  assert.equal(adjustment.body.data.stock.quantity, 8);

  const transfer = await request(app).post(`${inventoryRoute}/transfer`).set('Authorization', `Bearer ${admin}`).send({ productId, fromWarehouseId: warehouseId, toWarehouseId: secondWarehouseId, quantity: 3, reason: 'Balanceo entre almacenes' });
  assert.equal(transfer.status, 201, 'INV-005: transferencia actualiza ambos almacenes');
  assert.equal(transfer.body.data.stocks[0].quantity, 5);
  assert.equal(transfer.body.data.stocks[1].quantity, 3);
  assert.equal(transfer.body.data.movements.length, 2, 'INV-006: transferencia registra ambos movimientos');
  assert.deepEqual(transfer.body.data.movements.map(item => item.type).sort(), ['TRANSFER_IN', 'TRANSFER_OUT']);
  assert.equal(transfer.body.data.movements[0].transferId, transfer.body.data.movements[1].transferId);
  assert.deepEqual(transfer.body.data.movements.map(item => item.quantity), [3, 3], 'INV-006: ambos movimientos guardan la cantidad transferida');
  assert.deepEqual(transfer.body.data.movements.map(item => item.previousQuantity), [8, 0]);
  assert.deepEqual(transfer.body.data.movements.map(item => item.newQuantity), [5, 3]);

  const movementsBeforeSecondHalfFailure = await InventoryMovement.countDocuments();
  const auditsBeforeSecondHalfFailure = await AuditLog.countDocuments({ module: 'inventory' });
  const originalMovementCreate = InventoryMovement.create;
  let movementCreateCalls = 0;
  InventoryMovement.create = async function createWithInjectedFailure(...args) {
    movementCreateCalls += 1;
    if (movementCreateCalls === 2) throw new Error('INV-ROLLBACK simulated second movement failure');
    return originalMovementCreate.apply(this, args);
  };
  let secondMovementFailure;
  try {
    secondMovementFailure = await request(app).post(`${inventoryRoute}/transfer`).set('Authorization', `Bearer ${admin}`).send({ productId, fromWarehouseId: warehouseId, toWarehouseId: secondWarehouseId, quantity: 1, reason: 'Prueba de rollback en segundo movimiento' });
  } finally {
    InventoryMovement.create = originalMovementCreate;
  }
  assert.equal(secondMovementFailure.status, 500, 'INV-ROLLBACK: la falla del segundo movimiento aborta la transferencia');
  assert.equal(secondMovementFailure.body.message, 'Error interno del servidor', 'el error interno no se expone en la respuesta');
  assert.equal((await InventoryStock.findOne({ productId, warehouseId })).quantity, 5, 'INV-ROLLBACK: stock origen permanece intacto');
  assert.equal((await InventoryStock.findOne({ productId, warehouseId: secondWarehouseId })).quantity, 3, 'INV-ROLLBACK: stock destino permanece intacto');
  assert.equal(await InventoryMovement.countDocuments(), movementsBeforeSecondHalfFailure, 'INV-ROLLBACK: no quedan movimientos parciales');
  assert.equal(await AuditLog.countDocuments({ module: 'inventory' }), auditsBeforeSecondHalfFailure, 'INV-ROLLBACK: no queda auditoría parcial');

  const movementCountBeforeFailedTransfer = await InventoryMovement.countDocuments();
  const failedTransfer = await request(app).post(`${inventoryRoute}/transfer`).set('Authorization', `Bearer ${admin}`).send({ productId, fromWarehouseId: warehouseId, toWarehouseId: secondWarehouseId, quantity: 99, reason: 'Debe revertirse' });
  assert.equal(failedTransfer.status, 409, 'INV-008: falla la transferencia sin stock suficiente');
  assert.equal(await InventoryMovement.countDocuments(), movementCountBeforeFailedTransfer, 'INV-008: el rollback elimina los dos movimientos parciales');
  assert.equal((await InventoryStock.findOne({ productId, warehouseId })).quantity, 5);
  assert.equal((await InventoryStock.findOne({ productId, warehouseId: secondWarehouseId })).quantity, 3);

  const concurrentExits = await Promise.all([
    request(app).post(`${inventoryRoute}/exit`).set('Authorization', `Bearer ${admin}`).send({ productId, warehouseId, quantity: 4, reason: 'Salida concurrente A' }),
    request(app).post(`${inventoryRoute}/exit`).set('Authorization', `Bearer ${admin}`).send({ productId, warehouseId, quantity: 2, reason: 'Salida concurrente B' })
  ]);
  assert.deepEqual(concurrentExits.map(response => response.status).sort((a, b) => a - b), [201, 409], 'INV-009: solo una salida concurrente puede consumir el stock disponible');
  assert.ok((await InventoryStock.findOne({ productId, warehouseId })).quantity >= 0);

  const stockSearch = await request(app).get(`${inventoryRoute}?search=HER-1&warehouseId=${warehouseId}`).set('Authorization', `Bearer ${admin}`);
  assert.equal(stockSearch.status, 200);
  assert.equal(stockSearch.body.data[0].product.name, 'Martillo');
  const movementSearch = await request(app).get(`${inventoryRoute}/movements?search=martillo&warehouseId=${warehouseId}&limit=100`).set('Authorization', `Bearer ${admin}`);
  assert.equal(movementSearch.status, 200);
  assert.ok(movementSearch.body.data.some(item => item.type === 'TRANSFER_OUT'));
  assert.ok(movementSearch.body.data.some(item => item.type === 'OUT'));
  const inventoryAudits = await request(app).get('/api/reports/audit?module=inventory&limit=100').set('Authorization', `Bearer ${admin}`);
  assert.deepEqual(new Set(inventoryAudits.body.data.map(item => item.action)), new Set(['inventory.entry', 'inventory.exit', 'inventory.adjustment', 'inventory.transfer']));

  const salesRoute = '/api/sales';
  const salesWarehouseId = secondWarehouseId;
  const stockBeforeDraft = await InventoryStock.findOne({ productId, warehouseId: salesWarehouseId });
  const createSalePayload = { customerId: client.body.data.id, status: 'confirmed', items: [{ productId, warehouseId: salesWarehouseId, quantity: 2, taxRate: 16 }] };
  const createdSale = await request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send(createSalePayload);
  assert.equal(createdSale.status, 201, 'VEN-001: crea una venta en borrador');
  const saleId = createdSale.body.data.id;
  assert.match(createdSale.body.data.folio, /^VEN-\d{4}-\d{6}$/);
  assert.equal(createdSale.body.data.status, 'draft');
  assert.equal(createdSale.body.data.items[0].productNameSnapshot, 'Martillo');
  assert.equal(createdSale.body.data.subtotal, 30);
  assert.equal(createdSale.body.data.taxes, 4.8);
  assert.equal(createdSale.body.data.total, 34.8);
  assert.equal((await InventoryStock.findOne({ productId, warehouseId: salesWarehouseId })).quantity, stockBeforeDraft.quantity, 'VEN-001: crear draft no modifica inventario');

  const salesList = await request(app).get(`${salesRoute}?status=draft&search=${encodeURIComponent(createdSale.body.data.folio)}&page=1&limit=10`).set('Authorization', `Bearer ${admin}`);
  assert.equal(salesList.status, 200, 'VEN-002: listado persistente con búsqueda y filtros');
  assert.equal(salesList.body.data[0].id, saleId);
  const saleDetail = await request(app).get(`${salesRoute}/${saleId}`).set('Authorization', `Bearer ${admin}`);
  assert.equal(saleDetail.status, 200);
  assert.equal(saleDetail.body.data.customer.name, 'Cliente Uno');

  const confirmedSale = await request(app).post(`${salesRoute}/${saleId}/confirm`).set('Authorization', `Bearer ${admin}`).send();
  assert.equal(confirmedSale.status, 200, 'VEN-003: confirma venta');
  assert.equal(confirmedSale.body.data.status, 'confirmed');
  assert.ok(confirmedSale.body.data.confirmedAt);
  assert.equal((await InventoryStock.findOne({ productId, warehouseId: salesWarehouseId })).quantity, 1, 'VEN-004: la confirmación descuenta stock');
  const saleMovement = await InventoryMovement.findOne({ referenceType: 'sale', referenceId: saleId, type: 'SALE' });
  assert.ok(saleMovement, 'VEN-005: crea movimiento SALE');
  assert.equal(saleMovement.quantity, 2);
  assert.equal(saleMovement.previousQuantity, 3);
  assert.equal(saleMovement.newQuantity, 1);
  assert.equal(String(saleMovement.userId), login.body.data.user.id);

  const lowStockDraft = await request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send({ ...createSalePayload, items: [{ ...createSalePayload.items[0], quantity: 2 }] });
  assert.equal(lowStockDraft.status, 201);
  const movementCountBeforeLowStock = await InventoryMovement.countDocuments();
  const lowStockConfirm = await request(app).post(`${salesRoute}/${lowStockDraft.body.data.id}/confirm`).set('Authorization', `Bearer ${admin}`).send();
  assert.equal(lowStockConfirm.status, 409, 'VEN-006: rechaza confirmación con stock insuficiente');
  assert.equal(lowStockConfirm.body.error, 'INSUFFICIENT_STOCK');
  assert.equal((await Sale.findById(lowStockDraft.body.data.id)).status, 'draft');
  assert.equal(await InventoryMovement.countDocuments(), movementCountBeforeLowStock);

  const reversal = await request(app).post(`${salesRoute}/${saleId}/cancel`).set('Authorization', `Bearer ${admin}`).send();
  assert.equal(reversal.status, 200, 'VEN-009: cancelar venta confirmada');
  assert.equal(reversal.body.data.status, 'cancelled');
  assert.ok(reversal.body.data.cancelledAt);
  assert.equal((await InventoryStock.findOne({ productId, warehouseId: salesWarehouseId })).quantity, 3);
  assert.ok(await InventoryMovement.findOne({ referenceType: 'sale', referenceId: saleId, type: 'RETURN' }));
  assert.equal((await request(app).post(`${salesRoute}/${saleId}/cancel`).set('Authorization', `Bearer ${admin}`).send()).status, 409, 'VEN-010: no permite cancelar dos veces');
  assert.equal((await request(app).post(`${salesRoute}/${saleId}/confirm`).set('Authorization', `Bearer ${admin}`).send()).status, 409, 'VEN-011: no permite reactivar una venta cancelada');

  const cancelledDraft = await request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send(createSalePayload);
  assert.equal(cancelledDraft.status, 201);
  const stockBeforeDraftCancel = (await InventoryStock.findOne({ productId, warehouseId: salesWarehouseId })).quantity;
  const draftCancel = await request(app).post(`${salesRoute}/${cancelledDraft.body.data.id}/cancel`).set('Authorization', `Bearer ${admin}`).send();
  assert.equal(draftCancel.status, 200, 'VEN-008: cancela borrador sin inventario');
  assert.equal((await InventoryStock.findOne({ productId, warehouseId: salesWarehouseId })).quantity, stockBeforeDraftCancel);
  assert.equal((await request(app).post(`${salesRoute}/${cancelledDraft.body.data.id}/cancel`).set('Authorization', `Bearer ${admin}`).send()).status, 409);

  assert.equal((await request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send({ customerId: client.body.data.id, items: [] })).status, 400);
  assert.equal((await request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send({ customerId: 'bad-id', items: createSalePayload.items })).status, 400);
  assert.equal((await request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send({ customerId: new mongoose.Types.ObjectId().toString(), items: createSalePayload.items })).status, 404);
  assert.equal((await request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send({ ...createSalePayload, items: [{ ...createSalePayload.items[0], quantity: 0 }] })).status, 400);
  assert.equal((await request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send({ ...createSalePayload, items: [{ ...createSalePayload.items[0], unitPrice: 1 }] })).status, 400);
  assert.equal((await request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send({ ...createSalePayload, items: [{ ...createSalePayload.items[0], productId: new mongoose.Types.ObjectId().toString() }] })).status, 404);

  const secondDraft = await request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send(createSalePayload);
  assert.equal(secondDraft.status, 201);
  assert.notEqual(secondDraft.body.data.folio, createdSale.body.data.folio, 'VEN-013: folios son únicos');
  const stockBeforeDraftUpdate = (await InventoryStock.findOne({ productId, warehouseId: salesWarehouseId })).quantity;
  const updatedDraft = await request(app).put(`${salesRoute}/${secondDraft.body.data.id}`).set('Authorization', `Bearer ${admin}`).send({ items: [{ ...createSalePayload.items[0], quantity: 1 }] });
  assert.equal(updatedDraft.status, 200);
  assert.equal(updatedDraft.body.data.total, 17.4);
  assert.equal((await InventoryStock.findOne({ productId, warehouseId: salesWarehouseId })).quantity, stockBeforeDraftUpdate);
  const [concurrentFolioA, concurrentFolioB] = await Promise.all([
    request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send(createSalePayload),
    request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send(createSalePayload)
  ]);
  assert.deepEqual([concurrentFolioA.status, concurrentFolioB.status], [201, 201]);
  assert.notEqual(concurrentFolioA.body.data.folio, concurrentFolioB.body.data.folio, 'VEN-013: la secuencia mantiene unicidad concurrente');
  await request(app).put(`/api/products/${productId}`).set('Authorization', `Bearer ${admin}`).send({ name: 'Martillo actualizado' });
  const persistedSnapshot = await request(app).get(`${salesRoute}/${secondDraft.body.data.id}`).set('Authorization', `Bearer ${admin}`);
  assert.equal(persistedSnapshot.body.data.items[0].productNameSnapshot, 'Martillo', 'VEN-014: conserva snapshot histórico del producto');

  assert.equal((await request(app).get(salesRoute).set('Authorization', `Bearer ${verifiedOperatorLogin.body.data.token}`)).status, 403, 'VEN-012: lectura requiere permiso');
  assert.equal((await request(app).post(salesRoute).set('Authorization', `Bearer ${verifiedOperatorLogin.body.data.token}`).send(createSalePayload)).status, 403, 'VEN-012: creación requiere permiso');
  assert.equal((await request(app).post(`${salesRoute}/${secondDraft.body.data.id}/confirm`).set('Authorization', `Bearer ${verifiedOperatorLogin.body.data.token}`).send()).status, 403);
  assert.equal((await Sale.findById(secondDraft.body.data.id)).status, 'draft');

  await request(app).post(`${inventoryRoute}/adjust`).set('Authorization', `Bearer ${admin}`).send({ productId, warehouseId: salesWarehouseId, newQuantity: 5, reason: 'Preparar prueba de concurrencia de ventas' });
  const concurrentSaleA = await request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send({ ...createSalePayload, items: [{ ...createSalePayload.items[0], quantity: 4 }] });
  const concurrentSaleB = await request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send({ ...createSalePayload, items: [{ ...createSalePayload.items[0], quantity: 4 }] });
  const concurrentSaleResults = await Promise.all([
    request(app).post(`${salesRoute}/${concurrentSaleA.body.data.id}/confirm`).set('Authorization', `Bearer ${admin}`).send(),
    request(app).post(`${salesRoute}/${concurrentSaleB.body.data.id}/confirm`).set('Authorization', `Bearer ${admin}`).send()
  ]);
  assert.deepEqual(concurrentSaleResults.map(result => result.status).sort((a, b) => a - b), [200, 409], 'VEN-015: solo una venta concurrente puede consumir el stock');
  assert.equal((await InventoryStock.findOne({ productId, warehouseId: salesWarehouseId })).quantity, 1);
  const concurrentStatuses = await Promise.all([concurrentSaleA.body.data.id, concurrentSaleB.body.data.id].map(async id => (await Sale.findById(id)).status));
  assert.deepEqual(concurrentStatuses.sort(), ['confirmed', 'draft']);

  await request(app).post(`${inventoryRoute}/adjust`).set('Authorization', `Bearer ${admin}`).send({ productId, warehouseId: salesWarehouseId, newQuantity: 5, reason: 'Preparar prueba de rollback de venta' });
  const rollbackSale = await request(app).post(salesRoute).set('Authorization', `Bearer ${admin}`).send({ ...createSalePayload, items: [createSalePayload.items[0], createSalePayload.items[0]] });
  const movementCountBeforeSaleRollback = await InventoryMovement.countDocuments();
  const auditCountBeforeSaleRollback = await AuditLog.countDocuments({ module: { $in: ['sales', 'inventory'] } });
  const originalSaleMovementCreate = InventoryMovement.create;
  let saleMovementCreateCalls = 0;
  InventoryMovement.create = async function failSecondSaleMovement(...args) {
    saleMovementCreateCalls += 1;
    if (saleMovementCreateCalls === 2) throw new Error('VEN-007 simulated movement failure');
    return originalSaleMovementCreate.apply(this, args);
  };
  let saleRollbackResponse;
  try {
    saleRollbackResponse = await request(app).post(`${salesRoute}/${rollbackSale.body.data.id}/confirm`).set('Authorization', `Bearer ${admin}`).send();
  } finally {
    InventoryMovement.create = originalSaleMovementCreate;
  }
  assert.equal(saleRollbackResponse.status, 500, 'VEN-007: falla después de modificar inventario y revierte');
  assert.equal((await InventoryStock.findOne({ productId, warehouseId: salesWarehouseId })).quantity, 5);
  assert.equal((await Sale.findById(rollbackSale.body.data.id)).status, 'draft');
  assert.equal(await InventoryMovement.countDocuments(), movementCountBeforeSaleRollback);
  assert.equal(await AuditLog.countDocuments({ module: { $in: ['sales', 'inventory'] } }), auditCountBeforeSaleRollback);

  const deactivateProduct = await request(app).delete(`/api/products/${product.body.data.id}`).set('Authorization', `Bearer ${admin}`);
  assert.equal(deactivateProduct.status, 200);
  assert.equal(deactivateProduct.body.data.status, 'inactive');
  const missingUser = await request(app).get(`/api/users/${new mongoose.Types.ObjectId()}`).set('Authorization', `Bearer ${admin}`);
  assert.equal(missingUser.status, 404);

  const passwordChange = await request(app).patch('/api/auth/password').set('Authorization', `Bearer ${admin}`).send({ currentPassword: 'clave-de-prueba-muy-larga', newPassword: 'otra-clave-de-prueba-larga' });
  assert.equal(passwordChange.status, 200);
  const oldPasswordLogin = await request(app).post('/api/auth/login').send({ email: 'admin@test.invalid', password: 'clave-de-prueba-muy-larga' });
  assert.equal(oldPasswordLogin.status, 401);
  const newPasswordLogin = await request(app).post('/api/auth/login').send({ email: 'admin@test.invalid', password: 'otra-clave-de-prueba-larga' });
  assert.equal(newPasswordLogin.status, 200);

  const logs = await request(app).get('/api/reports/audit').set('Authorization', `Bearer ${admin}`);
  const recentLogs = await request(app).get('/api/reports/audit?limit=100').set('Authorization', `Bearer ${admin}`);
  const salesLogs = await request(app).get('/api/reports/audit?module=sales&limit=100').set('Authorization', `Bearer ${admin}`);
  const inventoryLogsAfterSales = await request(app).get('/api/reports/audit?module=inventory&limit=100').set('Authorization', `Bearer ${admin}`);
  assert.equal(logs.status, 200);
  assert.ok(recentLogs.body.data.some(entry => entry.module === 'users' && entry.action === 'user.created'));
  assert.ok(recentLogs.body.data.some(entry => entry.module === 'auth' && entry.action === 'email.verified'));
  assert.ok(salesLogs.body.data.some(entry => entry.action === 'sale.created'));
  assert.ok(salesLogs.body.data.some(entry => entry.action === 'sale.confirmed'));
  assert.ok(salesLogs.body.data.some(entry => entry.action === 'sale.cancelled'));
  assert.ok(inventoryLogsAfterSales.body.data.some(entry => entry.action === 'inventory.sale'));
  assert.ok(inventoryLogsAfterSales.body.data.some(entry => entry.action === 'inventory.sale.reversal'));
  const attemptedLogWrite = await request(app).post('/api/reports/audit').set('Authorization', `Bearer ${admin}`).send({ action: 'fake', module: 'users' });
  assert.equal(attemptedLogWrite.status, 404);
});
