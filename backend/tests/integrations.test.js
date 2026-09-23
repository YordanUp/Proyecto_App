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

test('GET /api/integrations requiere autenticación', async () => {
  const response = await request(app).get('/api/integrations');

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'UNAUTHORIZED');
});

test('GET /api/integrations devuelve integraciones con token válido', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .get('/api/integrations')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.data));
});

test('POST /api/integrations crea integración con permisos correctos', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/integrations')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'HubSpot',
      type: 'crm',
      owner: 'Marketing',
      enabled: true
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.name, 'HubSpot');
});
