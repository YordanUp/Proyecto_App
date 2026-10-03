const { getMetrics, restrictDashboard } = require('../services/dashboardService');
const { successResponse } = require('../utils/response');

async function getDashboard(req, res, next) {
  try {
    const data = restrictDashboard(await getMetrics(), req.user?.permissions);
    return successResponse(res, 200, 'Dashboard consultado', data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getDashboard };
