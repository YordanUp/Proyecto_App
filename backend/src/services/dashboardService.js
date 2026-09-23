const { dashboardMetricsSeed, chartSeed } = require('../data/dashboard');

function getMetrics() {
  return dashboardMetricsSeed;
}

function getRevenueChart() {
  return chartSeed;
}

module.exports = {
  getMetrics,
  getRevenueChart
};
