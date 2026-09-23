const { listIntegrations, createIntegration } = require('../services/integrationsService');
const { successResponse, errorResponse } = require('../utils/response');

function getIntegrations(req, res) {
  return successResponse(res, 200, 'Integraciones consultadas', listIntegrations());
}

function createIntegrationController(req, res) {
  try {
    const integration = createIntegration(req.body);
    return successResponse(res, 201, 'Integración creada correctamente', integration);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'INTEGRATION_CREATE_ERROR');
  }
}

module.exports = {
  getIntegrations,
  createIntegrationController
};
