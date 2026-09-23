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

test('GET /api/finance/accounts requiere autenticación', async () => {
  const response = await request(app).get('/api/finance/accounts');

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'UNAUTHORIZED');
});

test('POST /api/finance/accounts crea cuenta', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/finance/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      code: '1020',
      name: 'Banco Principal',
      type: 'asset',
      balance: 4000
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.code, '1020');
});

test('POST /api/finance/payments crea pago', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/finance/payments')
    .set('Authorization', `Bearer ${token}`)
    .send({
      type: 'bank',
      amount: 250,
      reference: 'PAY-002',
      status: 'approved'
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.reference, 'PAY-002');
});
