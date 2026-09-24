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

test('MongoDB integration: auth, RBAC, uniqueness, catalogs and audit', {
  skip: testUri ? false : 'Define TEST_MONGODB_URI con una instancia desechable de MongoDB compatible con transacciones'
}, async t => {
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

  const login = await request(app).post('/api/auth/login').send({ email: 'admin@test.invalid', password: 'clave-de-prueba-muy-larga' });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.permissions.includes('users.create'), true);
  const admin = login.body.data.token;

  const createdUser = await request(app).post('/api/users').set('Authorization', `Bearer ${admin}`).send({ name: 'Operador', email: 'operator@test.invalid', password: 'clave-operador-larga', role: managerRole.id });
  assert.equal(createdUser.status, 201);
  assert.equal(createdUser.body.data.permissions.includes('users.create'), false);

  const duplicate = await request(app).post('/api/users').set('Authorization', `Bearer ${admin}`).send({ name: 'Duplicado', email: 'operator@test.invalid', password: 'clave-operador-larga', role: managerRole.id });
  assert.equal(duplicate.status, 409);

  const operatorLogin = await request(app).post('/api/auth/login').send({ email: 'operator@test.invalid', password: 'clave-operador-larga' });
  const denied = await request(app).get('/api/users').set('Authorization', `Bearer ${operatorLogin.body.data.token}`);
  assert.equal(denied.status, 403);
  const forbiddenUserCreation = await request(app).post('/api/users').set('Authorization', `Bearer ${operatorLogin.body.data.token}`).send({ name: 'Escalado', email: 'escalated@test.invalid', password: 'clave-operador-larga', role: 'admin-test' });
  assert.equal(forbiddenUserCreation.status, 403);

  const roleUpdate = await request(app).put(`/api/roles/${managerRole.id}`).set('Authorization', `Bearer ${admin}`).send({ permissions: ['dashboard.read', 'users.read'] });
  assert.equal(roleUpdate.status, 200);
  const refreshedRoleAccess = await request(app).get('/api/users').set('Authorization', `Bearer ${operatorLogin.body.data.token}`);
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
  assert.equal(logs.status, 200);
  assert.ok(logs.body.data.some(entry => entry.module === 'users' && entry.action === 'create'));
  const attemptedLogWrite = await request(app).post('/api/reports/audit').set('Authorization', `Bearer ${admin}`).send({ action: 'fake', module: 'users' });
  assert.equal(attemptedLogWrite.status, 404);
});
