const test = require('node:test');
const assert = require('node:assert/strict');
const { syncAdminPermissions } = require('../scripts/adminPermissionSync');

const required = ['users.read', 'purchases.update', 'purchases.receive', 'finance.receive_payment', 'finance.make_payment'];
const oldAdmin = () => ({ _id: 'admin-role-id', name: 'admin', isSystem: true, permissions: ['custom.future', 'users.read'] });

function fakeRoleModel(roles = [oldAdmin()]) {
  let writes = 0;
  return {
    get writes() { return writes; },
    find: async filter => roles.filter(role => role.name === filter.name && role.isSystem === filter.isSystem).map(role => ({ ...role, permissions: [...role.permissions] })),
    findById: async id => roles.find(role => role._id === id),
    updateOne: async (filter, update) => {
      writes += 1;
      const role = roles.find(item => item._id === filter._id && item.name === filter.name && item.isSystem === filter.isSystem);
      if (!role) return { matchedCount: 0 };
      const additions = update.$addToSet.permissions.$each;
      role.permissions = [...new Set([...role.permissions, ...additions])];
      return { matchedCount: 1 };
    }
  };
}

test('ADM-PERM-001/002: agrega faltantes y conserva permisos existentes', async () => {
  const RoleModel = fakeRoleModel();
  const auditEntries = [];
  const result = await syncAdminPermissions({ RoleModel, permissions: required, mode: 'apply', recordAudit: async entry => auditEntries.push(entry) });
  assert.equal(result.changed, true);
  assert.deepEqual((await RoleModel.findById('admin-role-id')).permissions, [...new Set([...oldAdmin().permissions, ...required])]);
  assert.equal(result.addedCount, 4);
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0].recordId, 'admin-role-id');
  assert.deepEqual(auditEntries[0].before.permissions, oldAdmin().permissions);
});

test('ADM-PERM-003: segunda ejecución es idempotente', async () => {
  const RoleModel = fakeRoleModel();
  await syncAdminPermissions({ RoleModel, permissions: required, mode: 'apply' });
  const result = await syncAdminPermissions({ RoleModel, permissions: required, mode: 'apply' });
  assert.equal(result.changed, false);
  assert.equal(RoleModel.writes, 1);
});

test('ADM-PERM-004: dry-run reporta faltantes sin escribir', async () => {
  const RoleModel = fakeRoleModel();
  const before = (await RoleModel.findById('admin-role-id')).permissions;
  const result = await syncAdminPermissions({ RoleModel, permissions: required, mode: 'dry-run' });
  assert.equal(RoleModel.writes, 0);
  assert.equal((await RoleModel.findById('admin-role-id')).permissions, before);
  assert.equal(result.missingPermissions.length, 4);
});

test('ADM-PERM-005/006: solo actualiza el rol admin de sistema y no toca usuarios', async () => {
  const RoleModel = fakeRoleModel([oldAdmin(), { _id: 'other-role', name: 'manager', isSystem: false, permissions: [] }]);
  await syncAdminPermissions({ RoleModel, permissions: required, mode: 'apply' });
  assert.deepEqual((await RoleModel.findById('other-role')).permissions, []);
  assert.equal(RoleModel.writes, 1);
});

test('ADM-PERM-007/008: falla si admin falta o está duplicado', async () => {
  await assert.rejects(syncAdminPermissions({ RoleModel: fakeRoleModel([]), permissions: required, mode: 'apply' }), /No existe/);
  await assert.rejects(syncAdminPermissions({ RoleModel: fakeRoleModel([oldAdmin(), oldAdmin()]), permissions: required, mode: 'apply' }), /estado ambiguo/);
});

test('ADM-PERM-008: falla si PERMISSIONS está vacío o el modo no es explícito', async () => {
  await assert.rejects(syncAdminPermissions({ RoleModel: fakeRoleModel(), permissions: [], mode: 'dry-run' }), /PERMISSIONS está vacía/);
  await assert.rejects(syncAdminPermissions({ RoleModel: fakeRoleModel(), permissions: required }), /Indica --dry-run o --apply/);
});
