const service = require('../services/userService');
const { successResponse, errorResponse } = require('../utils/response');

async function getUsers(req, res, next) {
  try {
    const result = await service.listUsers(req.query);
    return res.status(200).json({ success: true, message: 'Usuarios consultados correctamente', data: result.items, pagination: result.pagination });
  } catch (e) { return next(e); }
}
async function getUser(req, res, next) {
  try { const user = await service.getUserById(req.params.id); return user ? successResponse(res, 200, 'Usuario consultado', user) : errorResponse(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND'); }
  catch (e) { return next(e); }
}
async function createUserController(req, res, next) { try { return successResponse(res, 201, 'Usuario creado correctamente', await service.createUser(req.body, req.user.id)); } catch (e) { return next(e); } }
async function updateUserController(req, res, next) {
  try { const user = await service.updateUser(req.params.id, req.body, req.user.id); return user ? successResponse(res, 200, 'Usuario actualizado correctamente', user) : errorResponse(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND'); }
  catch (e) { return next(e); }
}
async function toggleStatus(req, res, next) {
  try { const user = await service.toggleUserStatus(req.params.id, req.body.status, req.user.id); return user ? successResponse(res, 200, 'Estado del usuario actualizado', user) : errorResponse(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND'); }
  catch (e) { return next(e); }
}
async function changeRole(req, res, next) {
  try { const user = await service.changeUserRole(req.params.id, req.body.role, req.user.id); return user ? successResponse(res, 200, 'Rol actualizado correctamente', user) : errorResponse(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND'); }
  catch (e) { return next(e); }
}

module.exports = { getUsers, getUser, createUserController, updateUserController, toggleStatus, changeRole };
