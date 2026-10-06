const service = require('../services/integrationsService');
const { successResponse } = require('../utils/response');

async function getIntegrations(req, res, next) {
  try {
    const result = await service.listIntegrations(req.query);
    return res.status(200).json({ success: true, message: 'Integraciones consultadas correctamente', data: result.items, pagination: result.pagination });
  } catch (error) { return next(error); }
}
async function getIntegration(req, res, next) {
  try { return successResponse(res, 200, 'Integración consultada correctamente', await service.getIntegrationById(req.params.id)); }
  catch (error) { return next(error); }
}
async function createIntegration(req, res, next) {
  try { return successResponse(res, 201, 'Integración creada correctamente', await service.createIntegration(req.body || {}, req.user.id)); }
  catch (error) { return next(error); }
}
async function updateIntegration(req, res, next) {
  try { return successResponse(res, 200, 'Integración actualizada correctamente', await service.updateIntegration(req.params.id, req.body || {}, req.user.id)); }
  catch (error) { return next(error); }
}
async function enableIntegration(req, res, next) {
  try { return successResponse(res, 200, 'Integración habilitada correctamente', await service.enableIntegration(req.params.id, req.user.id)); }
  catch (error) { return next(error); }
}
async function disableIntegration(req, res, next) {
  try { return successResponse(res, 200, 'Integración deshabilitada correctamente', await service.disableIntegration(req.params.id, req.user.id)); }
  catch (error) { return next(error); }
}

module.exports = { getIntegrations, getIntegration, createIntegration, updateIntegration, enableIntegration, disableIntegration };
