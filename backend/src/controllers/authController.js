const User = require('../models/User');
const { verifyPassword, hashPassword, signToken } = require('../services/authService');
const { recordAudit } = require('../services/auditService');
const mongoose = require('mongoose');
const { successResponse, errorResponse } = require('../utils/response');
const emailVerificationService = require('../services/emailVerificationService');

const safeUser = (user, permissions) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role?.name,
  permissions,
  status: user.status,
  emailVerified: user.emailVerified !== false,
  lastAccess: user.lastAccessAt
});

async function login(req, res, next) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password;
    if (!email || typeof password !== 'string') return errorResponse(res, 400, 'Email y contraseña son requeridos', 'VALIDATION_ERROR');
    if (Buffer.byteLength(password, 'utf8') > 72) return errorResponse(res, 401, 'Credenciales inválidas', 'INVALID_CREDENTIALS');
    const user = await User.findOne({ email }).select('+passwordHash').populate('role');
    if (!user || user.status !== 'active' || !(await verifyPassword(password, user.passwordHash))) {
      return errorResponse(res, 401, 'Credenciales inválidas', 'INVALID_CREDENTIALS');
    }
    if (!user.emailVerified) return errorResponse(res, 403, 'Debes confirmar tu correo antes de iniciar sesión.', 'EMAIL_NOT_VERIFIED');
    user.lastAccessAt = new Date();
    await user.save();
    const permissions = user.role.permissions;
    const token = signToken({ sub: user.id });
    return successResponse(res, 200, 'Login exitoso', { token, user: safeUser(user, permissions) });
  } catch (error) { return next(error); }
}

async function verifyEmail(req, res, next) {
  try {
    const data = await emailVerificationService.verifyEmail(req.body?.token);
    return successResponse(res, 200, 'Correo verificado correctamente', data);
  } catch (error) { return next(error); }
}

async function resendVerification(req, res, next) {
  try {
    await emailVerificationService.resendVerification(req.body?.email);
    return successResponse(res, 200, 'Si la cuenta existe y requiere verificación, se enviará un correo.', {});
  } catch (error) { return next(error); }
}

async function profile(req, res, next) {
  try {
    const user = await User.findById(req.user.id).populate('role');
    if (!user || user.status !== 'active') return errorResponse(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND');
    return successResponse(res, 200, 'Perfil consultado', safeUser(user, user.role.permissions));
  } catch (error) { return next(error); }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || Buffer.byteLength(currentPassword, 'utf8') > 72 || typeof newPassword !== 'string' || newPassword.length < 12 || Buffer.byteLength(newPassword, 'utf8') > 72) {
      return errorResponse(res, 400, 'La contraseña actual y una nueva de al menos 12 caracteres (máximo 72 bytes) son requeridas', 'VALIDATION_ERROR');
    }
    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user) return errorResponse(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND');
    if (!(await verifyPassword(currentPassword, user.passwordHash))) return errorResponse(res, 400, 'La contraseña actual es incorrecta', 'INVALID_PASSWORD');
    user.passwordHash = await hashPassword(newPassword);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await user.save({ session });
        await recordAudit({ userId: user.id, action: 'password.change', module: 'users', recordId: user.id, session });
      });
    } finally { await session.endSession(); }
    return successResponse(res, 200, 'Contraseña actualizada correctamente', {});
  } catch (error) { return next(error); }
}

function logout(req, res) {
  return successResponse(res, 200, 'Sesión cerrada correctamente; elimina el token en el cliente', {});
}

module.exports = { login, profile, changePassword, logout, verifyEmail, resendVerification };
