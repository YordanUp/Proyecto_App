function withSession(query, session) {
  return session && typeof query.session === 'function' ? query.session(session) : query;
}

async function syncAdminPermissions({ RoleModel, permissions, mode, session = null, recordAudit = null }) {
  if (!['dry-run', 'apply'].includes(mode)) {
    throw new Error('Indica --dry-run o --apply para continuar');
  }
  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw new Error('La lista PERMISSIONS está vacía; se abortó la migración');
  }

  const roleQuery = withSession(RoleModel.find({ name: 'admin', isSystem: true }), session);
  const roles = await (typeof roleQuery.lean === 'function' ? roleQuery.lean() : roleQuery);
  if (roles.length === 0) throw new Error('No existe el rol admin de sistema; no se modificó MongoDB');
  if (roles.length !== 1) throw new Error(`Se encontraron ${roles.length} roles admin de sistema; estado ambiguo, no se modificó MongoDB`);

  const role = roles[0];
  if (!Array.isArray(role.permissions)) throw new Error('El rol admin tiene permisos en formato inválido; no se modificó MongoDB');
  const current = new Set(role.permissions);
  const missing = [...new Set(permissions)].filter(permission => !current.has(permission));
  const summary = {
    event: 'admin_permissions_sync',
    mode,
    roleId: String(role._id),
    roleName: role.name,
    currentPermissionCount: role.permissions.length,
    missingPermissions: missing,
    addedCount: 0,
    changed: false
  };

  if (mode === 'dry-run' || missing.length === 0) return summary;

  const result = await RoleModel.updateOne(
    { _id: role._id, name: 'admin', isSystem: true },
    { $addToSet: { permissions: { $each: missing } } },
    session ? { session } : undefined
  );
  if (result.matchedCount !== 1) throw new Error('El rol admin cambió durante la migración; vuelva a ejecutar el dry-run');

  const updatedQuery = withSession(RoleModel.findById(role._id), session);
  const updated = await (typeof updatedQuery.lean === 'function' ? updatedQuery.lean() : updatedQuery);
  const updatedPermissions = new Set(updated?.permissions || []);
  const stillMissing = [...new Set(permissions)].filter(permission => !updatedPermissions.has(permission));
  if (stillMissing.length) throw new Error(`La verificación posterior falló; faltan ${stillMissing.length} permisos`);

  if (recordAudit) {
    await recordAudit({
      action: 'permissions.sync',
      module: 'roles',
      recordId: String(role._id),
      before: { permissions: role.permissions },
      after: { permissions: updated.permissions }
    });
  }

  summary.addedCount = missing.filter(permission => !current.has(permission) && updatedPermissions.has(permission)).length;
  summary.changed = summary.addedCount > 0;
  summary.currentPermissionCount = updated.permissions.length;
  summary.missingPermissions = [];
  return summary;
}

module.exports = { syncAdminPermissions };
