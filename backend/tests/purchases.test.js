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

test('GET /api/purchases/orders requiere autenticación', async () => {
  const response = await request(app).get('/api/purchases/orders');

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'UNAUTHORIZED');
});

test('POST /api/purchases/orders crea orden de compra', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/purchases/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      supplierId: 's1',
      items: [{ productId: 'p1', quantity: 10, unitPrice: 54 }],
      total: 540,
      status: 'draft'
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.supplierId, 's1');
});

test('POST /api/purchases crea compra', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/purchases')
    .set('Authorization', `Bearer ${token}`)
    .send({
      supplierId: 's1',
      items: [{ productId: 'p1', quantity: 10, unitPrice: 54 }],
      total: 540,
      status: 'received'
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, 'received');
});
