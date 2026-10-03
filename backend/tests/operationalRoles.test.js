const test = require('node:test');
const assert = require('node:assert/strict');
const { PERMISSIONS } = require('../src/services/permissions');
const { ROLE_DEFINITIONS } = require('../src/services/operationalRoles');
const { syncOperationalRoles } = require('../scripts/operationalRoleSync');

function fakeModel() {
  const roles = [{ _id: 'admin-id', id: 'admin-id', name: 'admin', description: 'Admin', isSystem: true, permissions: [...PERMISSIONS] }];
  let writes = 0;
  const query = value => ({ lean: async () => value });
  return {
    roles,
    get writes() { return writes; },
    find: filter => query(roles.filter(role => role.name === filter.name && role.isSystem === filter.isSystem)),
    findOne: filter => query(roles.find(role => role.name === filter.name) || null),
    create: async ([data]) => {
      writes += 1;
      const role = { ...data, _id: `${data.name}-id`, id: `${data.name}-id` };
      roles.push(role);
      return [role];
    },
    updateOne: async (filter, update) => {
      writes += 1;
      const role = roles.find(item => String(item._id) === String(filter._id) && item.name === filter.name && item.isSystem === filter.isSystem);
      if (!role) return { matchedCount: 0 };
      Object.assign(role, update.$set);
      return { matchedCount: 1 };
    }
  };
}

test('ROLE-001: admin conserva todos sus permisos y no es alterado', async () => {
  const model = fakeModel();
  const before = [...model.roles[0].permissions];
  await syncOperationalRoles({ RoleModel: model, permissions: PERMISSIONS, mode: 'apply' });
  assert.deepEqual(model.roles[0].permissions, before);
  assert.equal(model.roles[0].description, 'Admin');
});

test('ROLE-002/003: ventas recibe exactamente su matriz y no puede crear productos', () => {
  assert.deepEqual(ROLE_DEFINITIONS.ventas.permissions, ['dashboard.read', 'products.read', 'categories.read', 'clients.read', 'clients.create', 'clients.update', 'inventory.read', 'sales.read', 'sales.create', 'sales.update', 'sales.cancel', 'reports.read']);
  assert.equal(ROLE_DEFINITIONS.ventas.permissions.includes('products.create'), false);
  assert.equal(ROLE_DEFINITIONS.ventas.permissions.some(permission => permission.startsWith('purchases.')), false);
});

test('ROLE-004/005: compras puede recibir compras y no administrar usuarios', () => {
  assert.ok(ROLE_DEFINITIONS.compras.permissions.includes('purchases.receive'));
  assert.equal(ROLE_DEFINITIONS.compras.permissions.some(permission => permission.startsWith('users.')), false);
  assert.equal(ROLE_DEFINITIONS.compras.permissions.some(permission => permission.startsWith('roles.')), false);
});

test('ROLE-006/007: almacén ajusta inventario y no tiene finanzas', () => {
  assert.ok(ROLE_DEFINITIONS.almacen.permissions.includes('inventory.adjust'));
  assert.equal(ROLE_DEFINITIONS.almacen.permissions.some(permission => permission.startsWith('finance.')), false);
});

test('ROLE-008/009: finanzas puede registrar cobros y pagos sin editar productos', () => {
  assert.ok(ROLE_DEFINITIONS.finanzas.permissions.includes('finance.receive_payment'));
  assert.ok(ROLE_DEFINITIONS.finanzas.permissions.includes('finance.make_payment'));
  assert.equal(ROLE_DEFINITIONS.finanzas.permissions.some(permission => permission === 'products.create' || permission === 'products.update'), false);
});

test('ROLE-010: supervisor solo tiene permisos de lectura', () => {
  assert.ok(ROLE_DEFINITIONS.supervisor.permissions.every(permission => permission.endsWith('.read')));
});

test('ROLE-011: sincronización crea roles y la segunda aplicación es idempotente', async () => {
  const model = fakeModel();
  const first = await syncOperationalRoles({ RoleModel: model, permissions: PERMISSIONS, mode: 'apply' });
  const writesAfterFirst = model.writes;
  const second = await syncOperationalRoles({ RoleModel: model, permissions: PERMISSIONS, mode: 'apply' });
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(model.writes, writesAfterFirst);
  assert.equal(model.roles.filter(role => role.isSystem).length, 6);
});

test('ROLE-012: dry-run enumera cambios sin escribir', async () => {
  const model = fakeModel();
  const summary = await syncOperationalRoles({ RoleModel: model, permissions: PERMISSIONS, mode: 'dry-run' });
  assert.equal(summary.changed, true);
  assert.equal(model.writes, 0);
  assert.equal(model.roles.length, 1);
});

test('aborta si el admin no está completo o una matriz contiene permisos inexistentes', async () => {
  const model = fakeModel();
  model.roles[0].permissions = ['dashboard.read'];
  await assert.rejects(syncOperationalRoles({ RoleModel: model, permissions: PERMISSIONS, mode: 'dry-run' }), /admin no contiene todos/);
  await assert.rejects(syncOperationalRoles({ RoleModel: fakeModel(), permissions: ['dashboard.read'], mode: 'dry-run' }), /desconocidos/);
});

test('no sobrescribe un rol personalizado con el mismo nombre', async () => {
  const model = fakeModel();
  model.roles.push({ _id: 'custom-sales', id: 'custom-sales', name: 'ventas', isSystem: false, permissions: ['products.read'] });
  await assert.rejects(syncOperationalRoles({ RoleModel: model, permissions: PERMISSIONS, mode: 'apply' }), /pertenece a un rol personalizado/);
  assert.equal(model.writes, 0);
});
