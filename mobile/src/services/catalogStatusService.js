const { hasPermission } = require('./permissions');

function statusActions(user, definition, record) {
  const inactive = record?.status === 'inactive';
  return {
    canDeactivate: !inactive && hasPermission(user, definition.deletePermission),
    canActivate: inactive && hasPermission(user, definition.updatePermission)
  };
}

function deactivateCatalogRecord(request, definition, id) {
  return request(`${definition.endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

function activateCatalogRecord(request, definition, id) {
  return request(`${definition.endpoint}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { status: 'active' }
  });
}

function statusLabel(status) {
  return status === 'inactive' ? 'Inactivo' : 'Activo';
}

module.exports = { statusActions, deactivateCatalogRecord, activateCatalogRecord, statusLabel };
