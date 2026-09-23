const { listSettings, createSetting } = require('../services/settingsService');
const { successResponse, errorResponse } = require('../utils/response');

function getSettings(req, res) {
  return successResponse(res, 200, 'Configuración consultada', listSettings());
}

function createSettingController(req, res) {
  try {
    const setting = createSetting(req.body);
    return successResponse(res, 201, 'Configuración creada correctamente', setting);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'SETTING_CREATE_ERROR');
  }
}

module.exports = {
  getSettings,
  createSettingController
};
