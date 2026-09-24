const PERMISSIONS = [
  'users.read', 'users.create', 'users.update', 'users.delete', 'users.assign_role', 'roles.read', 'roles.create', 'roles.update', 'roles.delete',
  'categories.read', 'categories.create', 'categories.update', 'categories.delete', 'products.read', 'products.create', 'products.update', 'products.delete',
  'clients.read', 'clients.create', 'clients.update', 'clients.delete', 'suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
  'warehouses.read', 'warehouses.create', 'warehouses.update', 'warehouses.delete', 'dashboard.read', 'inventory.read', 'inventory.create', 'inventory.adjust',
  'sales.read', 'sales.create', 'sales.update', 'sales.cancel', 'purchases.read', 'purchases.create', 'purchases.approve', 'purchases.cancel',
  'finance.read', 'finance.create', 'finance.approve', 'reports.read', 'reports.create', 'notifications.read', 'notifications.create',
  'audit.read', 'settings.read', 'settings.create', 'settings.update', 'integrations.read', 'integrations.create', 'integrations.update'
];
module.exports = { PERMISSIONS };
