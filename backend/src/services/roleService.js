const { seededRoles } = require('../data/seed');

const roles = seededRoles;

function listRoles() {
  return roles;
}

function getRoleById(id) {
  return roles.find((role) => role.id === id);
}

function createRole(data) {
  if (!data.name) {
    throw new Error('El nombre del rol es requerido');
  }

  const role = {
    id: `r${Date.now()}`,
    name: data.name,
    description: data.description || '',
    permissions: data.permissions || [],
    createdAt: new Date().toISOString()
  };

  roles.push(role);
  return role;
}

module.exports = {
  listRoles,
  getRoleById,
  createRole
};
