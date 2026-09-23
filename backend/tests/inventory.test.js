const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

async function loginAsAdmin() {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@erp.local', password: 'admin123' });

  return response.body.data.token;
}

test('GET /api/inventory requiere autenticación', async () => {
  const response = await request(app).get('/api/inventory');

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'UNAUTHORIZED');
});

test('POST /api/inventory/adjust registra entrada', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/inventory/adjust')
    .set('Authorization', `Bearer ${token}`)
    .send({
      productId: 'p1',
      type: 'entry',
      quantity: 5,
      warehouseId: 'w1',
      userId: 'u1',
      reason: 'Compra extra',
      documentId: 'doc-002'
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.type, 'entry');
});

test('POST /api/inventory/adjust rechaza salida mayor al stock', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/inventory/adjust')
    .set('Authorization', `Bearer ${token}`)
    .send({
      productId: 'p2',
      type: 'output',
      quantity: 999,
      warehouseId: 'w1',
      userId: 'u1',
      reason: 'Venta no autorizada',
      documentId: 'doc-003'
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error, 'INVENTORY_MOVEMENT_ERROR');
});
