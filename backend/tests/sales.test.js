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

test('GET /api/sales/quotations requiere autenticación', async () => {
  const response = await request(app).get('/api/sales/quotations');

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'UNAUTHORIZED');
});

test('POST /api/sales/quotations crea cotización', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/sales/quotations')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customerId: 'cl1',
      items: [{ productId: 'p1', quantity: 1, unitPrice: 260 }],
      total: 260
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.customerId, 'cl1');
});

test('POST /api/sales/sales crea venta', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/sales/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customerId: 'cl1',
      items: [{ productId: 'p1', quantity: 1, unitPrice: 260 }],
      total: 260,
      status: 'confirmed'
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, 'confirmed');
});
