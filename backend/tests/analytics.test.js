const test = require('node:test');
const assert = require('node:assert/strict');
const { utcRanges, restrictDashboard, salesPeriod } = require('../src/services/dashboardService');
const { buildFilter, csvCell, pagination, MAX_PAGE_LIMIT, MAX_EXPORT_LIMIT } = require('../src/services/reportService');

test('Dashboard periods use UTC day and month boundaries', () => {
  const ranges = utcRanges(new Date('2026-03-01T00:05:00.000Z'));
  assert.equal(ranges.today.$gte.toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(ranges.today.$lt.toISOString(), '2026-03-02T00:00:00.000Z');
  assert.equal(ranges.month.$gte.toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(ranges.month.$lt.toISOString(), '2026-04-01T00:00:00.000Z');
});

test('Dashboard devuelve solo los datos que corresponden a permisos de lectura', () => {
  const dashboard = { metrics: { salesToday: 10, pendingPurchases: 3, lowStockCount: 2, receivables: { balance: 4 } }, recentSales: [1], recentFinancialMovements: [2], stockAlerts: [3] };
  const salesView = restrictDashboard(dashboard, ['sales.read']);
  assert.equal(salesView.metrics.salesToday, 10);
  assert.equal('receivables' in salesView.metrics, false);
  assert.deepEqual(salesView.recentFinancialMovements, []);
  assert.deepEqual(salesView.stockAlerts, []);
  assert.equal(dashboard.metrics.receivables.balance, 4);
});

test('Ventas netas son brutas confirmadas menos devoluciones procesadas', () => {
  assert.deepEqual(salesPeriod(1000, 300, 4), { gross: 1000, returns: 300, net: 700, count: 4 });
  assert.deepEqual(salesPeriod(1000, 0), { gross: 1000, returns: 0, net: 1000, count: 0 });
  assert.deepEqual(salesPeriod(250, 250), { gross: 250, returns: 250, net: 0, count: 0 });
  assert.deepEqual(salesPeriod(100.1, 30.05), { gross: 100.1, returns: 30.05, net: 70.05, count: 0 });
});

test('Los reportes limitan páginas a 100 y permiten exportaciones hasta 10000', () => {
  assert.equal(pagination({ page: '1', limit: '1000' }).limit, MAX_PAGE_LIMIT);
  assert.equal(pagination({ page: '1', limit: '50000' }, MAX_EXPORT_LIMIT).limit, MAX_EXPORT_LIMIT);
});

test('Report filters reject invalid dates and unsupported combinations', async () => {
  await assert.rejects(buildFilter('sales', { from: '2026-02-30' }), { errorCode: 'VALIDATION_ERROR' });
  await assert.rejects(buildFilter('sales', { from: '2026-05-02', to: '2026-05-01' }), { errorCode: 'INVALID_DATE_RANGE' });
  await assert.rejects(buildFilter('inventory-stock', { status: 'active' }), { errorCode: 'UNSUPPORTED_FILTER' });
  await assert.rejects(buildFilter('sales', { supplier: 'proveedor' }), { errorCode: 'UNSUPPORTED_FILTER' });
  await assert.rejects(buildFilter('missing', {}), { errorCode: 'INVALID_REPORT_TYPE' });
});

test('Report search treats user text literally', async () => {
  const { filter } = await buildFilter('sales', { search: 'A.B' });
  assert.equal(filter.$or[0].folio.test('A.B'), true);
  assert.equal(filter.$or[0].folio.test('AxB'), false);
});

test('Los periodos financieros de ventas usan confirmedAt y los de devoluciones processedAt', async () => {
  const { filter: salesFilter } = await buildFilter('sales', { from: '2026-10-01', to: '2026-10-31' });
  const { filter: returnsFilter } = await buildFilter('sales-returns', { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(salesFilter.confirmedAt, { $gte: new Date('2026-10-01T00:00:00.000Z'), $lte: new Date('2026-10-31T23:59:59.999Z') });
  assert.equal('createdAt' in salesFilter, false);
  assert.deepEqual(returnsFilter.processedAt, salesFilter.confirmedAt);
});

test('El filtro de movimientos admite devoluciones de venta como entradas', async () => {
  const { filter } = await buildFilter('inventory-movements', { movementType: 'SALE_RETURN' });
  assert.equal(filter.type, 'SALE_RETURN');
});

test('CSV fields escape quotes and protect spreadsheet formulas', () => {
  assert.equal(csvCell('Cliente "A", S.A.'), '"Cliente ""A"", S.A."');
  assert.equal(csvCell('=HYPERLINK("https://invalid")'), '"\'=HYPERLINK(""https://invalid"")"');
  assert.equal(csvCell(-4.5), '"-4.5"');
});
