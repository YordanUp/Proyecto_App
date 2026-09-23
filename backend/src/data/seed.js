const seededUsers = [
  {
    id: 'u1',
    name: 'Administrador',
    email: 'admin@erp.local',
    passwordHash: '$2a$10$ytT1SbTnKPcn2hzt5ArVw.ztYNkispDvghQhvFn1iXjE7vu7nXTZi',
    role: 'admin',
    permissions: [
      'dashboard:read',
      'users:read',
      'users:write',
      'roles:read',
      'roles:write',
      'products:read',
      'products:write',
      'clients:read',
      'clients:write',
      'suppliers:read',
      'suppliers:write',
      'categories:read',
      'categories:write',
      'inventory:read',
      'inventory:write',
      'sales:read',
      'sales:write',
      'purchases:read',
      'purchases:write',
      'finance:read',
      'finance:write',
      'reports:read',
      'reports:write',
      'notifications:read',
      'notifications:write',
      'audit:read',
      'audit:write',
      'integrations:read',
      'integrations:write',
      'settings:read',
      'settings:write'
    ],
    status: 'active',
    lastAccess: null,
    createdAt: new Date().toISOString()
  },
  {
    id: 'u2',
    name: 'Gerente',
    email: 'gerente@erp.local',
    passwordHash: '$2a$10$ckCxzwS.hdM.iqx1oKvg5uiX4UW.Y9t1jDtv/QZqOw8Taag2xC2xm',
    role: 'manager',
    permissions: ['dashboard:read', 'users:read'],
    status: 'active',
    lastAccess: null,
    createdAt: new Date().toISOString()
  }
];

const seededRoles = [
  {
    id: 'r1',
    name: 'admin',
    description: 'Administrador del sistema',
    permissions: ['dashboard:read', 'users:read', 'users:write', 'roles:read', 'roles:write', 'integrations:read', 'integrations:write', 'settings:read', 'settings:write'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'r2',
    name: 'manager',
    description: 'Gerente',
    permissions: ['dashboard:read', 'users:read'],
    createdAt: new Date().toISOString()
  }
];

module.exports = { seededUsers, seededRoles };
