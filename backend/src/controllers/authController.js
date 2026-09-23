const { signToken, verifyPassword, hashPassword } = require('../services/authService');
const { successResponse, errorResponse } = require('../utils/response');
const { seededUsers } = require('../data/seed');

const users = seededUsers;

async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return errorResponse(res, 400, 'Email y contraseña son requeridos', 'VALIDATION_ERROR');
  }

  const user = users.find((entry) => entry.email === email);
  if (!user) {
    return errorResponse(res, 401, 'Credenciales inválidas', 'INVALID_CREDENTIALS');
  }

  const isMatch = await verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    return errorResponse(res, 401, 'Credenciales inválidas', 'INVALID_CREDENTIALS');
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions
  });

  user.lastAccess = new Date().toISOString();

  return successResponse(res, 200, 'Login exitoso', {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      lastAccess: user.lastAccess
    }
  });
}

async function logout(req, res) {
  return successResponse(res, 200, 'Sesión cerrada correctamente', {});
}

function profile(req, res) {
  const user = users.find((entry) => entry.id === req.user.sub);

  if (!user) {
    return errorResponse(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND');
  }

  return successResponse(res, 200, 'Perfil consultado', {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    status: user.status,
    lastAccess: user.lastAccess
  });
}

async function resetPassword(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return errorResponse(res, 400, 'Email y nueva contraseña requeridos', 'VALIDATION_ERROR');
  }

  const user = users.find((entry) => entry.email === email);
  if (!user) {
    return errorResponse(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND');
  }

  user.passwordHash = await hashPassword(password);
  user.lastAccess = new Date().toISOString();

  return successResponse(res, 200, 'Contraseña actualizada correctamente', {});
}

module.exports = { login, logout, profile, resetPassword };
