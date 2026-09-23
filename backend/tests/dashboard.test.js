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

test('GET /api/dashboard requiere autenticación', async () => {
  const response = await request(app).get('/api/dashboard');

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'UNAUTHORIZED');
});

test('GET /api/dashboard devuelve métricas', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .get('/api/dashboard')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(response.body.data.metrics);
  assert.ok(Array.isArray(response.body.data.chart));
});
