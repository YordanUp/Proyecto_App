const { listRoles, getRoleById, createRole } = require('../services/roleService');
const { successResponse, errorResponse } = require('../utils/response');

function getRoles(req, res) {
  return successResponse(res, 200, 'Roles consultados correctamente', listRoles());
}

function getRole(req, res) {
  const role = getRoleById(req.params.id);

  if (!role) {
    return errorResponse(res, 404, 'Rol no encontrado', 'ROLE_NOT_FOUND');
  }

  return successResponse(res, 200, 'Rol consultado', role);
}

function createRoleController(req, res) {
  try {
    const role = createRole(req.body);
    return successResponse(res, 201, 'Rol creado correctamente', role);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'ROLE_CREATE_ERROR');
  }
}

module.exports = { getRoles, getRole, createRoleController };
