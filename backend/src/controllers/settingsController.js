const settingsService = require('../services/settingsService');
const { successResponse } = require('../utils/response');

async function getSettings(req, res, next) {
  try { return successResponse(res, 200, 'Configuración consultada correctamente', await settingsService.listSettings()); }
  catch (error) { return next(error); }
}

async function updateSetting(req, res, next) {
  try {
    const keys = Object.keys(req.body || {});
    if (keys.length !== 1 || keys[0] !== 'value') {
      const error = settingsService.settingError(400, 'VALIDATION_ERROR', 'Envía únicamente el campo value');
      return next(error);
    }
    const setting = await settingsService.updateSetting(req.params.key, req.body.value, req.user.id);
    return successResponse(res, 200, 'Configuración actualizada correctamente', setting);
  } catch (error) { return next(error); }
}

module.exports = { getSettings, updateSetting };
