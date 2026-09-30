process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Role = require('../src/models/Role');
const User = require('../src/models/User');
const auditService = require('../src/services/auditService');
const { PERMISSIONS } = require('../src/services/permissions');
const { ensureInitialAdmin, validateBootstrapEnvironment } = require('../src/services/bootstrapService');

const validEnv = () => ({
  INITIAL_ADMIN_NAME: 'Admin Producción',
  INITIAL_ADMIN_EMAIL: 'Admin@Example.com',
  INITIAL_ADMIN_PASSWORD: 'Clave-segura-2026'
});

function setup(t, { role = null, existingAdmin = null, existingEmail = null } = {}) {
  mongoose.connection.readyState = 1;
  const session = { withTransaction: async callback => callback(), endSession: async () => {} };
  t.mock.method(mongoose, 'startSession', async () => session);
  let nextRole = role;
  let nextAdmin = existingAdmin;
  let nextEmail = existingEmail;
  const created = { roles: [], users: [], audits: [] };
  t.mock.method(Role, 'findOne', filter => ({ session: async () => filter.name === 'admin' ? nextRole : null }));
  t.mock.method(User, 'findOne', filter => ({ session: async () => filter.role ? nextAdmin : nextEmail }));
  t.mock.method(Role, 'create', async ([data]) => {
    const createdRole = { ...data, _id: new mongoose.Types.ObjectId(), id: 'role-id' };
    created.roles.push(data);
    nextRole = createdRole;
    return [createdRole];
  });
  t.mock.method(User, 'create', async ([data]) => {
    const createdUser = { ...data, _id: new mongoose.Types.ObjectId(), id: 'user-id' };
    created.users.push(data);
    nextAdmin = createdUser;
    return [createdUser];
  });
  t.mock.method(auditService, 'recordAudit', async entry => { created.audits.push(entry); });
  return { created };
}

test('boot001: crea rol de sistema y admin activo con hash y permisos', async t => {
  const { created } = setup(t);
  assert.deepEqual(await ensureInitialAdmin(validEnv()), { created: true });
  assert.equal(created.roles.length, 1);
  assert.equal(created.roles[0].isSystem, true);
  assert.deepEqual(created.roles[0].permissions, PERMISSIONS);
  assert.equal(created.users[0].name, 'Admin Producción');
  assert.equal(created.users[0].email, 'admin@example.com');
  assert.equal(created.users[0].status, 'active');
  assert.notEqual(created.users[0].passwordHash, validEnv().INITIAL_ADMIN_PASSWORD);
  assert.equal(created.audits.length, 2);
});

test('boot002: es idempotente si ya existe un usuario con rol admin', async t => {
  const role = { _id: new mongoose.Types.ObjectId(), id: 'role-id', isSystem: true, permissions: PERMISSIONS };
  const admin = { id: 'existing-admin' };
  const { created } = setup(t, { role, existingAdmin: admin });
  assert.deepEqual(await ensureInitialAdmin({}), { created: false });
  assert.deepEqual(created, { roles: [], users: [], audits: [] });
});

test('boot003: rechaza la ejecución si MongoDB no está conectado', async t => {
  setup(t);
  mongoose.connection.readyState = 0;
  await assert.rejects(ensureInitialAdmin(validEnv()), /MongoDB debe estar conectado/);
});

test('boot004: exige variables de entorno cuando no hay administrador', async t => {
  setup(t);
  await assert.rejects(ensureInitialAdmin({}), /Faltan INITIAL_ADMIN_NAME/);
});

test('boot005: valida nombre, correo y longitud mínima de contraseña', () => {
  assert.throws(() => validateBootstrapEnvironment({ ...validEnv(), INITIAL_ADMIN_PASSWORD: 'corta' }), /12 caracteres/);
  assert.throws(() => validateBootstrapEnvironment({ ...validEnv(), INITIAL_ADMIN_NAME: ' ' }), /INITIAL_ADMIN_NAME/);
  assert.throws(() => validateBootstrapEnvironment({ ...validEnv(), INITIAL_ADMIN_EMAIL: 'correo-inválido' }), /INITIAL_ADMIN_EMAIL/);
});

test('boot006: limita la contraseña a 72 bytes UTF-8', () => {
  assert.throws(() => validateBootstrapEnvironment({ ...validEnv(), INITIAL_ADMIN_PASSWORD: 'ñ'.repeat(37) }), /72 bytes/);
});

test('boot007: no modifica un rol admin de sistema existente', async t => {
  const role = { _id: new mongoose.Types.ObjectId(), id: 'role-id', isSystem: true, permissions: [...PERMISSIONS] };
  const before = [...role.permissions];
  const { created } = setup(t, { role });
  assert.deepEqual(await ensureInitialAdmin(validEnv()), { created: true });
  assert.deepEqual(role.permissions, before);
  assert.equal(created.roles.length, 0);
});

test('boot008: registra auditoría de rol y usuario sin datos de contraseña ni PII', async t => {
  const { created } = setup(t);
  await ensureInitialAdmin(validEnv());
  assert.deepEqual(created.audits.map(entry => entry.module), ['roles', 'users']);
  assert.equal(JSON.stringify(created.audits).includes(validEnv().INITIAL_ADMIN_PASSWORD), false);
  assert.equal(JSON.stringify(created.audits).includes('admin@example.com'), false);
});

test('boot009: no cambia credenciales aunque el entorno indique otros datos', async t => {
  const role = { _id: new mongoose.Types.ObjectId(), id: 'role-id', isSystem: true, permissions: PERMISSIONS };
  const { created } = setup(t, { role, existingAdmin: { id: 'existing-admin' } });
  const changedCredentials = { ...validEnv(), INITIAL_ADMIN_PASSWORD: 'otra-clave-que-no-debe-usarse' };
  assert.deepEqual(await ensureInitialAdmin(changedCredentials), { created: false });
  assert.equal(created.users.length, 0);
});

test('boot010: rechaza correo ya asignado y roles admin inseguros', async t => {
  setup(t, { existingEmail: { id: 'other-user' } });
  await assert.rejects(ensureInitialAdmin(validEnv()), /ya pertenece a otro usuario/);
  await t.test('rechaza un rol admin existente que no sea de sistema', async roleTest => {
    const invalidRole = { _id: new mongoose.Types.ObjectId(), id: 'role-id', isSystem: false, permissions: PERMISSIONS };
    setup(roleTest, { role: invalidRole });
    await assert.rejects(ensureInitialAdmin(validEnv()), /no es de sistema/);
  });
});
