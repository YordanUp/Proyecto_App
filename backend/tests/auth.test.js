const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

test('POST /api/auth/login autentica con usuario válido', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@erp.local', password: 'admin123' });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(response.body.data.token);
});

test('POST /api/auth/login rechaza credenciales inválidas', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@erp.local', password: 'incorrecta' });

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error, 'INVALID_CREDENTIALS');
});

test('GET /api/users requiere autenticación', async () => {
  const response = await request(app).get('/api/users');

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'UNAUTHORIZED');
});

test('GET /api/roles retorna roles autenticado', async () => {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@erp.local', password: 'admin123' });

  const response = await request(app)
    .get('/api/roles')
    .set('Authorization', `Bearer ${login.body.data.token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.data));
});
