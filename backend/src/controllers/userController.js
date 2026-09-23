const { listUsers, getUserById, createUser, updateUser, toggleUserStatus, changeUserRole } = require('../services/userService');
const { successResponse, errorResponse } = require('../utils/response');

async function getUsers(req, res) {
  const users = listUsers();
  return successResponse(res, 200, 'Usuarios consultados correctamente', users);
}

async function getUser(req, res) {
  const { id } = req.params;
  const user = getUserById(id);

  if (!user) {
    return errorResponse(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND');
  }

  return successResponse(res, 200, 'Usuario consultado', user);
}

async function createUserController(req, res) {
  try {
    const createdUser = await createUser(req.body);
    return successResponse(res, 201, 'Usuario creado correctamente', createdUser);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'USER_CREATE_ERROR');
  }
}

async function updateUserController(req, res) {
  try {
    const updatedUser = await updateUser(req.params.id, req.body);
    return successResponse(res, 200, 'Usuario actualizado correctamente', updatedUser);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'USER_UPDATE_ERROR');
  }
}

async function toggleStatus(req, res) {
  try {
    const user = toggleUserStatus(req.params.id, req.body.status);
    return successResponse(res, 200, 'Estado del usuario actualizado', user);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'USER_STATUS_ERROR');
  }
}

async function changeRole(req, res) {
  try {
    const user = changeUserRole(req.params.id, req.body.role);
    return successResponse(res, 200, 'Rol actualizado correctamente', user);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'USER_ROLE_ERROR');
  }
}

module.exports = {
  getUsers,
  getUser,
  createUserController,
  updateUserController,
  toggleStatus,
  changeRole
};
