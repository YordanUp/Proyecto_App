const metricDefinitions = [
  { key: 'sales', period: 'today', nested: 'gross', label: 'Ventas brutas hoy', money: true },
  { key: 'sales', period: 'today', nested: 'returns', label: 'Devoluciones hoy', money: true },
  { key: 'sales', period: 'today', nested: 'net', label: 'Ventas netas hoy', money: true },
  { key: 'sales', period: 'month', nested: 'gross', label: 'Ventas brutas del mes', money: true },
  { key: 'sales', period: 'month', nested: 'returns', label: 'Devoluciones del mes', money: true },
  { key: 'sales', period: 'month', nested: 'net', label: 'Ventas netas del mes', money: true },
  { key: 'pendingPurchases', label: 'Compras pendientes' }, { key: 'lowStockCount', label: 'Stock bajo' },
  { key: 'outOfStockCount', label: 'Sin existencias' }, { key: 'receivables', label: 'Por cobrar', money: true, nested: 'balance' },
  { key: 'payables', label: 'Por pagar', money: true, nested: 'balance' }
];

function readDashboardMetric(metrics, metric) {
  const value = metrics?.[metric.key];
  if (metric.key === 'sales' && metric.nested) return value?.[metric.period]?.[metric.nested] ?? 0;
  if (metric.nested) return value?.[metric.nested] ?? 0;
  return value ?? 0;
}

module.exports = { metricDefinitions, readDashboardMetric };
