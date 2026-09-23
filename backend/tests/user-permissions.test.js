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

test('GET /api/users con token válido devuelve lista', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.data));
});

test('POST /api/users con permisos correctos crea usuario', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Usuario QA',
      email: 'qa@erp.local',
      password: 'qa12345',
      role: 'manager',
      permissions: ['dashboard:read']
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.email, 'qa@erp.local');
});

test('PATCH /api/users/:id/status cambia estado', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .patch('/api/users/u1/status')
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'inactive' });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, 'inactive');
});

