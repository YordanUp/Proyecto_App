const service = require('../services/roleService');
const { successResponse, errorResponse } = require('../utils/response');
async function getRoles(req, res, next) { try { return successResponse(res, 200, 'Roles consultados correctamente', await service.listRoles()); } catch (e) { return next(e); } }
async function getRole(req, res, next) { try { const role = await service.getRoleById(req.params.id); return role ? successResponse(res, 200, 'Rol consultado', role) : errorResponse(res, 404, 'Rol no encontrado', 'ROLE_NOT_FOUND'); } catch (e) { return next(e); } }
async function createRoleController(req, res, next) { try { return successResponse(res, 201, 'Rol creado correctamente', await service.createRole(req.body, req.user.id)); } catch (e) { return next(e); } }
async function updateRoleController(req, res, next) {
  try { const role = await service.updateRole(req.params.id, req.body, req.user.id); return role ? successResponse(res, 200, 'Rol actualizado correctamente', role) : errorResponse(res, 404, 'Rol no encontrado', 'ROLE_NOT_FOUND'); }
  catch (e) { return next(e); }
}
module.exports = { getRoles, getRole, createRoleController, updateRoleController };
