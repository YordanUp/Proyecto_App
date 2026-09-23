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

test('GET /api/reports/reports requiere autenticación', async () => {
  const response = await request(app).get('/api/reports/reports');

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'UNAUTHORIZED');
});

test('POST /api/reports/reports crea reporte', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/reports/reports')
    .set('Authorization', `Bearer ${token}`)
    .send({
      type: 'inventory',
      title: 'Reporte de stock',
      status: 'ready'
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.type, 'inventory');
});

test('POST /api/reports/notifications crea notificación', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .post('/api/reports/notifications')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Inventario bajo',
      message: 'Hay productos con stock crítico',
      type: 'warning'
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.title, 'Inventario bajo');
});

test('GET /api/reports/audit devuelve auditoría', async () => {
  const token = await loginAsAdmin();
  const response = await request(app)
    .get('/api/reports/audit')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.data));
});
