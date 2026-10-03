export function hasPermission(user, permission) {
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}

export function hasAnyPermission(user, permissions) {
  return permissions.some(permission => hasPermission(user, permission));
}

export const ROUTE_PERMISSIONS = Object.freeze({
  '/': ['dashboard.read'],
  '/products': ['products.read'],
  '/inventory': ['inventory.read'],
  '/sales': ['sales.read'],
  '/purchases': ['purchases.read'],
  '/finance': ['finance.read'],
  '/reports': ['reports.read'],
  '/notifications': ['notifications.read'],
  '/integrations': ['integrations.read'],
  '/audit': ['audit.read'],
  '/users': ['users.read'],
  '/roles': ['roles.read'],
  '/settings': ['settings.read'],
  '/clients': ['clients.read', 'suppliers.read'],
  '/categories': ['categories.read'],
  '/warehouses': ['warehouses.read']
});
