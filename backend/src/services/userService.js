const { hashPassword } = require('./authService');
const { seededUsers } = require('../data/seed');

const users = seededUsers;

function listUsers() {
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    lastAccess: user.lastAccess,
    permissions: user.permissions
  }));
}

function getUserById(id) {
  return users.find((user) => user.id === id);
}

async function createUser(data) {
  if (!data.name || !data.email || !data.password || !data.role) {
    throw new Error('Nombre, email, password y rol son requeridos');
  }

  const exists = users.some((user) => user.email.toLowerCase() === data.email.toLowerCase());
  if (exists) {
    throw new Error('El email ya está registrado');
  }

  const user = {
    id: `u${Date.now()}`,
    name: data.name,
    email: data.email,
    passwordHash: await hashPassword(data.password),
    role: data.role,
    status: data.status || 'active',
    permissions: data.permissions || [],
    lastAccess: null,
    createdAt: new Date().toISOString()
  };

  users.push(user);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    permissions: user.permissions,
    lastAccess: user.lastAccess
  };
}

function updateUser(id, data) {
  const user = getUserById(id);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  if (data.name) user.name = data.name;
  if (data.email) user.email = data.email;
  if (data.role) user.role = data.role;
  if (data.permissions) user.permissions = data.permissions;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    permissions: user.permissions,
    lastAccess: user.lastAccess
  };
}

function toggleUserStatus(id, status) {
  const user = getUserById(id);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  const nextStatus = ['active', 'inactive'].includes(status) ? status : 'inactive';
  user.status = nextStatus;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status
  };
}

function changeUserRole(id, role) {
  const user = getUserById(id);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  if (!role) {
    throw new Error('El rol es requerido');
  }

  user.role = role;
  return {
    id: user.id,
    name: user.name,
    role: user.role
  };
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  changeUserRole
};
