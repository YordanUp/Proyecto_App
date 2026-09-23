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

test('GET /api/products requiere autenticación', async () => {
  const response = await request(app).get('/api/products');

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'UNAUTHORIZED');
});

test('GET /api/products devuelve lista autenticada', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .get('/api/products')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.data));
});

test('POST /api/products valida código duplicado', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      code: 'ELE-001',
      name: 'Teclado duplicado',
      categoryId: 'c1',
      purchasePrice: 100,
      salePrice: 150
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error, 'PRODUCT_CREATE_ERROR');
});

test('POST /api/clients crea cliente', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/clients')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Cliente QA',
      email: 'qa@cliente.com',
      phone: '+51 999 111 222'
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.name, 'Cliente QA');
});
