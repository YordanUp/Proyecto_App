const { ROLE_DEFINITIONS, validateRoleDefinitions } = require('../src/services/operationalRoles');

function withSession(query, session) {
  return session && typeof query.session === 'function' ? query.session(session) : query;
}

async function execute(query) {
  return typeof query.lean === 'function' ? query.lean() : query;
}

async function syncOperationalRoles({ RoleModel, permissions, mode, session = null, recordAudit = null }) {
  if (!['dry-run', 'apply'].includes(mode)) throw new Error('Indica --dry-run o --apply para continuar');
  validateRoleDefinitions(permissions);

  const adminQuery = withSession(RoleModel.find({ name: 'admin', isSystem: true }), session);
  const admins = await execute(adminQuery);
  if (admins.length !== 1) throw new Error(admins.length ? 'Se encontraron varios roles admin de sistema; estado ambiguo' : 'No existe el rol admin de sistema');
  if (!Array.isArray(admins[0].permissions) || permissions.some(permission => !admins[0].permissions.includes(permission))) {
    throw new Error('El rol admin no contiene todos los permisos actuales; sincronícelo por separado antes de continuar');
  }

  const changes = [];
  for (const [name, definition] of Object.entries(ROLE_DEFINITIONS)) {
    const roleQuery = withSession(RoleModel.findOne({ name }), session);
    const existing = await execute(roleQuery);
    if (existing && existing.isSystem !== true) throw new Error(`El nombre ${name} ya pertenece a un rol personalizado; no se modificó ningún rol`);
    const desired = { name, description: definition.description, permissions: [...definition.permissions], isSystem: true };
    const changed = !existing || existing.description !== desired.description || !Array.isArray(existing.permissions)
      || existing.permissions.length !== desired.permissions.length
      || desired.permissions.some(permission => !existing.permissions.includes(permission));
    changes.push({ name, action: !existing ? 'create' : changed ? 'update' : 'unchanged', roleId: existing ? String(existing._id) : null, desired, before: existing || null });
  }

  const summary = { mode, adminVerified: true, roles: changes.map(({ name, action, roleId, desired }) => ({ name, action, roleId, permissionCount: desired.permissions.length })), changed: changes.some(change => change.action !== 'unchanged') };
  if (mode === 'dry-run' || !summary.changed) return summary;

  for (const change of changes) {
    if (change.action === 'unchanged') continue;
    let role;
    if (change.action === 'create') {
      [role] = await RoleModel.create([change.desired], session ? { session } : undefined);
    } else {
      const result = await RoleModel.updateOne(
        { _id: change.before._id, name: change.name, isSystem: true },
        { $set: { description: change.desired.description, permissions: change.desired.permissions, isSystem: true } },
        session ? { session, runValidators: true } : { runValidators: true }
      );
      if (result.matchedCount !== 1) throw new Error(`El rol ${change.name} cambió durante la sincronización; vuelva a ejecutar el dry-run`);
      const updatedQuery = withSession(RoleModel.findOne({ _id: change.before._id, name: change.name, isSystem: true }), session);
      role = await execute(updatedQuery);
    }
    if (recordAudit) await recordAudit({ userId: null, action: `role.${change.action}`, module: 'roles', recordId: role.id || role._id, before: change.before, after: role, session });
  }
  return summary;
}

module.exports = { syncOperationalRoles };
