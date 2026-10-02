const { getMetrics } = require('../services/dashboardService');
const { successResponse } = require('../utils/response');

async function getDashboard(req, res, next) {
  try {
    const data = await getMetrics();
    return successResponse(res, 200, 'Dashboard consultado', data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getDashboard };
