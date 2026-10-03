const ROLE_DEFINITIONS = Object.freeze({
  ventas: {
    description: 'Gestión de ventas, clientes y consulta de existencias.',
    permissions: ['dashboard.read', 'products.read', 'categories.read', 'clients.read', 'clients.create', 'clients.update', 'inventory.read', 'sales.read', 'sales.create', 'sales.update', 'sales.cancel', 'reports.read']
  },
  compras: {
    description: 'Gestión y recepción de compras y proveedores.',
    permissions: ['dashboard.read', 'products.read', 'categories.read', 'suppliers.read', 'suppliers.create', 'suppliers.update', 'warehouses.read', 'inventory.read', 'purchases.read', 'purchases.create', 'purchases.update', 'purchases.approve', 'purchases.receive', 'purchases.cancel', 'reports.read']
  },
  almacen: {
    description: 'Consulta y control operativo de existencias.',
    permissions: ['dashboard.read', 'products.read', 'categories.read', 'warehouses.read', 'inventory.read', 'inventory.create', 'inventory.adjust', 'reports.read']
  },
  finanzas: {
    description: 'Consulta financiera, cobros y pagos.',
    permissions: ['dashboard.read', 'clients.read', 'suppliers.read', 'sales.read', 'purchases.read', 'finance.read', 'finance.create', 'finance.approve', 'finance.receive_payment', 'finance.make_payment', 'reports.read']
  },
  supervisor: {
    description: 'Consulta de operación y reportes sin permisos de escritura.',
    permissions: ['dashboard.read', 'products.read', 'categories.read', 'clients.read', 'suppliers.read', 'warehouses.read', 'inventory.read', 'sales.read', 'purchases.read', 'finance.read', 'reports.read']
  }
});

function validateRoleDefinitions(permissions) {
  const known = new Set(permissions);
  if (!known.size) throw new Error('La lista PERMISSIONS está vacía; se abortó la sincronización');
  for (const [name, definition] of Object.entries(ROLE_DEFINITIONS)) {
    const unique = new Set(definition.permissions);
    if (unique.size !== definition.permissions.length) throw new Error(`El rol ${name} contiene permisos duplicados`);
    const unknown = definition.permissions.filter(permission => !known.has(permission));
    if (unknown.length) throw new Error(`El rol ${name} contiene permisos desconocidos: ${unknown.join(', ')}`);
  }
}

module.exports = { ROLE_DEFINITIONS, validateRoleDefinitions };
