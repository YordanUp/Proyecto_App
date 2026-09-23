const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { successResponse, errorResponse } = require('../utils/response');
const { signToken, hashPassword, verifyPassword } = require('../services/authService');

const router = express.Router();

const users = [
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
    ]
  }
];

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return errorResponse(res, 400, 'Email y contraseña son requeridos', 'VALIDATION_ERROR');
  }

  const user = users.find((entry) => entry.email === email);

  if (!user) {
    return errorResponse(res, 401, 'Credenciales inválidas', 'INVALID_CREDENTIALS');
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return errorResponse(res, 401, 'Credenciales inválidas', 'INVALID_CREDENTIALS');
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions
  });

  return successResponse(res, 200, 'Login exitoso', {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    }
  });
});

router.post('/logout', authenticateToken, (req, res) => {
  return successResponse(res, 200, 'Sesión cerrada correctamente', {});
});

router.get('/profile', authenticateToken, (req, res) => {
  const user = users.find((entry) => entry.id === req.user.sub);

  if (!user) {
    return errorResponse(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND');
  }

  return successResponse(res, 200, 'Perfil consultado', {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions
  });
});

router.post('/reset-password', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return errorResponse(res, 400, 'Email y nueva contraseña requeridos', 'VALIDATION_ERROR');
  }

  const user = users.find((entry) => entry.email === email);
  if (!user) {
    return errorResponse(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND');
  }

  user.passwordHash = await hashPassword(password);

  return successResponse(res, 200, 'Contraseña actualizada correctamente', {});
});

module.exports = router;
