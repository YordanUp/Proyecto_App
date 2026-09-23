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

test('GET /api/settings requiere autenticación', async () => {
  const response = await request(app).get('/api/settings');

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'UNAUTHORIZED');
});

test('GET /api/settings devuelve configuración del sistema', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .get('/api/settings')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.data));
});

test('POST /api/settings crea un ajuste', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/settings')
    .set('Authorization', `Bearer ${token}`)
    .send({
      key: 'auto_backup',
      label: 'Respaldo automático',
      value: true,
      type: 'boolean'
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.key, 'auto_backup');
  assert.equal(response.body.data.value, true);
});
