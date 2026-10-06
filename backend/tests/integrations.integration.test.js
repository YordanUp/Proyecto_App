require('dotenv').config();
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const testUri = process.env.TEST_MONGODB_URI;
if (testUri) { const isolated = new URL(testUri); isolated.pathname = `/erp_integrations_${process.pid}_${Date.now()}`; process.env.MONGODB_URI = isolated.toString(); }

const app = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Role = require('../src/models/Role');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const Integration = require('../src/models/Integration');
const { hashPassword } = require('../src/services/authService');

test('INT-001..017: ciclo persistente, validación segura, RBAC, filtros y auditoría', { skip: testUri ? false : 'Define TEST_MONGODB_URI con MongoDB desechable compatible con transacciones' }, async t => {
  await connectDatabase();
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
  t.after(async () => { if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase(); await disconnectDatabase(); });

  const adminRole = await Role.create({ name: 'integrations-admin', permissions: ['integrations.read', 'integrations.create', 'integrations.update'] });
  const viewerRole = await Role.create({ name: 'integrations-viewer', permissions: ['integrations.read'] });
  const creatorRole = await Role.create({ name: 'integrations-creator', permissions: ['integrations.create'] });
  const editorRole = await Role.create({ name: 'integrations-editor', permissions: ['integrations.update'] });
  const createUser = async (name, role, password) => User.create({ name, email: `${name.toLowerCase().replaceAll(' ', '-')}@test.invalid`, passwordHash: await hashPassword(password), role: role._id });
  const admin = await createUser('Integration Admin', adminRole, 'integration-admin-password');
  const viewer = await createUser('Integration Viewer', viewerRole, 'integration-viewer-password');
  const creator = await createUser('Integration Creator', creatorRole, 'integration-creator-password');
  const editor = await createUser('Integration Editor', editorRole, 'integration-editor-password');
  const login = async user => {
    const password = user.name.toLowerCase().replaceAll(' ', '-') + '-password';
    const response = await request(app).post('/api/auth/login').send({ email: user.email, password });
    assert.equal(response.status, 200);
    return { Authorization: `Bearer ${response.body.data.token}` };
  };
  const [adminAuth, viewerAuth, creatorAuth, editorAuth] = await Promise.all([admin, viewer, creator, editor].map(login));

  const initial = await request(app).get('/api/integrations').set(adminAuth);
  assert.equal(initial.status, 200, 'INT-001 lista vacía'); assert.deepEqual(initial.body.data, []); assert.equal(initial.body.pagination.total, 0);
  assert.equal((await request(app).get('/api/integrations').set(viewerAuth)).status, 200, 'INT-011 RBAC read');
  assert.equal((await request(app).post('/api/integrations').set(creatorAuth).send({ name: 'Creator test', type: 'other' })).status, 201, 'INT-012 RBAC create');
  assert.equal((await request(app).post('/api/integrations').set(viewerAuth).send({ name: 'Denied', type: 'other' })).status, 403);
  assert.equal((await request(app).put('/api/integrations/000000000000000000000000').set(viewerAuth).send({ name: 'Denied' })).status, 403, 'INT-013 RBAC update');

  const created = await request(app).post('/api/integrations').set(adminAuth).send({ name: 'Integración Ágil', type: 'messaging', owner: 'Atención al cliente', description: 'Cuenta operativa', config: { environment: 'sandbox', region: 'mx', accountLabel: 'Principal' } });
  assert.equal(created.status, 201, 'INT-002 creación Mongo');
  const id = created.body.data.id;
  assert.equal(created.body.data.slug, 'integracion-agil');
  assert.equal(created.body.data.enabled, false); assert.equal(created.body.data.status, 'pending');
  assert.equal(created.body.data.lastSyncAt, null); assert.equal(created.body.data.lastError, null);
  assert.equal(await Integration.countDocuments(), 2, 'no existen seeds de integraciones');
  assert.equal((await request(app).get(`/api/integrations/${id}`).set(adminAuth)).status, 200);
  const auditCreate = await AuditLog.findOne({ action: 'integrations.create', module: 'integrations', recordId: id }).lean();
  assert.ok(auditCreate); assert.equal(String(auditCreate.userId), String(admin._id)); assert.equal(auditCreate.before, null);
  assert.equal(auditCreate.after.name, 'Integración Ágil', 'INT-014 auditoría create');

  assert.equal((await request(app).post('/api/integrations').set(adminAuth).send({ name: 'Duplicada', slug: 'integracion-agil', type: 'crm' })).status, 409, 'INT-003 slug único');
  assert.equal((await request(app).post('/api/integrations').set(adminAuth).send({ name: 'Tipo inválido', type: 'commerce' })).status, 400, 'INT-004 tipo inválido');
  for (const key of ['apiKey', 'PASSWORD', 'access_token', 'clientSecret', 'MONGODB_URI', 'JWT_SECRET']) {
    const rejected = await request(app).post('/api/integrations').set(adminAuth).send({ name: `Unsafe ${key}`, type: 'other', config: { [key]: 'do-not-save' } });
    assert.equal(rejected.status, 400, `INT-005/006/007 rechaza ${key}`);
    assert.equal(await Integration.countDocuments({ name: `Unsafe ${key}` }), 0);
  }

  const updated = await request(app).put(`/api/integrations/${id}`).set(adminAuth).send({ name: 'WhatsApp Business', description: 'Notas actualizadas', type: 'messaging', owner: 'Soporte', config: { environment: 'production', region: 'mx' } });
  assert.equal(updated.status, 200, 'INT-008 editar'); assert.equal(updated.body.data.slug, 'integracion-agil');
  assert.equal((await request(app).put(`/api/integrations/${id}`).set(adminAuth).send({ enabled: true, status: 'connected', lastSyncAt: new Date().toISOString() })).status, 400, 'PUT no falsifica estado ni sincronización');
  const auditUpdate = await AuditLog.findOne({ action: 'integrations.update', module: 'integrations', recordId: id }).lean();
  assert.equal(auditUpdate.before.name, 'Integración Ágil'); assert.equal(auditUpdate.after.name, 'WhatsApp Business', 'INT-015 auditoría update');

  const enabled = await request(app).post(`/api/integrations/${id}/enable`).set(adminAuth);
  assert.equal(enabled.status, 200, 'INT-009 activar'); assert.equal(enabled.body.data.enabled, true); assert.equal(enabled.body.data.status, 'pending');
  const disabled = await request(app).post(`/api/integrations/${id}/disable`).set(adminAuth);
  assert.equal(disabled.status, 200, 'INT-010 desactivar'); assert.equal(disabled.body.data.enabled, false); assert.equal(disabled.body.data.status, 'disconnected');
  assert.equal(await AuditLog.countDocuments({ module: 'integrations', recordId: id }), 4);
  assert.equal((await request(app).get('/api/integrations/000000000000000000000000').set(adminAuth)).status, 404, 'id válido inexistente retorna 404');

  await request(app).post('/api/integrations').set(adminAuth).send({ name: 'Payments one', type: 'payments', enabled: false });
  await request(app).post('/api/integrations').set(adminAuth).send({ name: 'CRM active', type: 'crm' }).then(async response => { await request(app).post(`/api/integrations/${response.body.data.id}/enable`).set(adminAuth); });
  const filtered = await request(app).get('/api/integrations?search=WhatsApp&type=messaging&status=disconnected&enabled=false&page=1&limit=1').set(adminAuth);
  assert.equal(filtered.status, 200); assert.equal(filtered.body.pagination.total, 1, 'INT-016/017 filtro y paginación'); assert.equal(filtered.body.data[0].name, 'WhatsApp Business');
  const paged = await request(app).get('/api/integrations?page=2&limit=1').set(adminAuth);
  assert.equal(paged.body.pagination.page, 2); assert.equal(paged.body.pagination.limit, 1); assert.ok(paged.body.pagination.pages >= 2);
});
