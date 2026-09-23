const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

test('GET /api/health responde estado correcto', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, 'Backend disponible');
});

test('GET /api retorna información base', async () => {
  const response = await request(app).get('/api');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.data.endpoints));
});

test('Ruta inexistente responde 404 con estructura estándar', async () => {
  const response = await request(app).get('/api/no-existe');

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error, 'ROUTE_NOT_FOUND');
});
