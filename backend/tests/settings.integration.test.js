require('dotenv').config();
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const testUri = process.env.TEST_MONGODB_URI;
if (testUri) { const isolated = new URL(testUri); isolated.pathname = `/erp_settings_${process.pid}_${Date.now()}`; process.env.MONGODB_URI = isolated.toString(); }

const app = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Role = require('../src/models/Role');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const SystemSetting = require('../src/models/SystemSetting');
const settingsService = require('../src/services/settingsService');
const { hashPassword } = require('../src/services/authService');

test('SET: persistencia, bootstrap idempotente, validaciones, RBAC y auditoría', { skip: testUri ? false : 'Define TEST_MONGODB_URI con MongoDB desechable compatible con transacciones' }, async t => {
  await connectDatabase();
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
  t.after(async () => { if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase(); await disconnectDatabase(); });

  const editorRole = await Role.create({ name: 'settings-editor', permissions: ['settings.read', 'settings.update'] });
  const viewerRole = await Role.create({ name: 'settings-viewer', permissions: ['settings.read'] });
  const editor = await User.create({ name: 'Settings Editor', email: 'settings-editor@test.invalid', passwordHash: await hashPassword('settings-editor-password'), role: editorRole._id });
  const viewer = await User.create({ name: 'Settings Viewer', email: 'settings-viewer@test.invalid', passwordHash: await hashPassword('settings-viewer-password'), role: viewerRole._id });
  const [editorLogin, viewerLogin] = await Promise.all([editor, viewer].map(user => request(app).post('/api/auth/login').send({ email: user.email, password: user.name === editor.name ? 'settings-editor-password' : 'settings-viewer-password' })));
  const auth = { Authorization: `Bearer ${editorLogin.body.data.token}` };
  const viewerAuth = { Authorization: `Bearer ${viewerLogin.body.data.token}` };

  assert.equal((await request(app).get('/api/settings').set(auth)).status, 200, 'SET-001 listado persistente');
  const dryRun = await settingsService.bootstrapSettings({ mode: 'dry-run' });
  assert.equal(dryRun.missing.length, 4);
  assert.equal(await SystemSetting.countDocuments(), 0, 'dry-run no escribe');
  const bootstrapSession = await mongoose.startSession();
  let bootstrapResult;
  try { await bootstrapSession.withTransaction(async () => { bootstrapResult = await settingsService.bootstrapSettings({ mode: 'apply', session: bootstrapSession }); }); }
  finally { await bootstrapSession.endSession(); }
  assert.equal(bootstrapResult.created, 4, 'SET-002 bootstrap');
  await SystemSetting.updateOne({ key: 'currency' }, { $set: { value: 'EUR' } });
  assert.equal((await settingsService.bootstrapSettings({ mode: 'apply' })).created, 0, 'SET-003/011 idempotencia');
  assert.equal((await SystemSetting.findOne({ key: 'currency' })).value, 'EUR', 'bootstrap conserva personalización');
  await assert.rejects(SystemSetting.create({ key: 'currency', label: 'Moneda duplicada', value: 'USD', type: 'select', category: 'general' }), error => error.code === 11000);
  assert.equal((await request(app).get('/api/settings').set(auth)).body.data.length, 4);

  const changed = await request(app).put('/api/settings/company_name').set(auth).send({ value: 'YordanUp ERP' });
  assert.equal(changed.status, 200, 'SET-004 actualización');
  assert.equal(changed.body.data.value, 'YordanUp ERP');
  const audit = await AuditLog.findOne({ action: 'settings.update', module: 'settings', recordId: 'company_name' }).lean();
  assert.equal(String(audit.userId), String(editor._id), 'SET-010 usuario auditado');
  assert.deepEqual(audit.before, { key: 'company_name', value: 'ERP Modular' });
  assert.deepEqual(audit.after, { key: 'company_name', value: 'YordanUp ERP' });

  for (const [key, value, code] of [['currency', 'CAD', 'currency'], ['timezone', 'UTC-5', 'timezone'], ['date_format', 'DD-MM-YYYY', 'date_format']]) {
    const invalid = await request(app).put(`/api/settings/${key}`).set(auth).send({ value });
    assert.equal(invalid.status, 400, `SET validation ${code}`);
  }
  assert.equal((await request(app).get('/api/settings').set(viewerAuth)).status, 200, 'SET-008 RBAC read');
  assert.equal((await request(app).put('/api/settings/company_name').set(viewerAuth).send({ value: 'No autorizado' })).status, 403, 'SET-009 RBAC update');
  assert.equal((await request(app).put('/api/settings/JWT_SECRET').set(auth).send({ value: 'secret' })).status, 404, 'no acepta keys arbitrarias ni secretos');
  assert.equal((await request(app).post('/api/settings').set(auth).send({ key: 'extra', value: 'value' })).status, 404, 'no existe creación libre');
  assert.equal((await request(app).put('/api/settings/company_name').set(auth).send({ value: 'Invalid', key: 'currency' })).status, 400, 'rechaza campos adicionales');
});
