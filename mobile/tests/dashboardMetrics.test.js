const test = require('node:test');
const assert = require('node:assert/strict');
const { metricDefinitions, readDashboardMetric } = require('../src/services/dashboardMetrics');

test('Mobile dashboard reads gross sales, processed returns and net sales for both periods', () => {
  const metrics = { sales: { today: { gross: 1000, returns: 300, net: 700 }, month: { gross: 2500, returns: 500, net: 2000 } } };
  const values = Object.fromEntries(metricDefinitions.filter(metric => metric.key === 'sales').map(metric => [metric.label, readDashboardMetric(metrics, metric)]));
  assert.deepEqual(values, {
    'Ventas brutas hoy': 1000, 'Devoluciones hoy': 300, 'Ventas netas hoy': 700,
    'Ventas brutas del mes': 2500, 'Devoluciones del mes': 500, 'Ventas netas del mes': 2000
  });
});

test('Mobile dashboard remains safe while an older API omits the new metrics', () => {
  const netToday = metricDefinitions.find(metric => metric.label === 'Ventas netas hoy');
  assert.equal(readDashboardMetric({}, netToday), 0);
});
