const { getMetrics, getRevenueChart } = require('../services/dashboardService');
const { successResponse } = require('../utils/response');

function getDashboard(req, res) {
  return successResponse(res, 200, 'Dashboard consultado', {
    metrics: getMetrics(),
    chart: getRevenueChart()
  });
}

module.exports = {
  getDashboard
};
