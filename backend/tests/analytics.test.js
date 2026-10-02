const test = require('node:test');
const assert = require('node:assert/strict');
const { utcRanges } = require('../src/services/dashboardService');
const { buildFilter, csvCell } = require('../src/services/reportService');

test('Dashboard periods use UTC day and month boundaries', () => {
  const ranges = utcRanges(new Date('2026-03-01T00:05:00.000Z'));
  assert.equal(ranges.today.$gte.toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(ranges.today.$lt.toISOString(), '2026-03-02T00:00:00.000Z');
  assert.equal(ranges.month.$gte.toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(ranges.month.$lt.toISOString(), '2026-04-01T00:00:00.000Z');
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

test('CSV fields escape quotes and protect spreadsheet formulas', () => {
  assert.equal(csvCell('Cliente "A", S.A.'), '"Cliente ""A"", S.A."');
  assert.equal(csvCell('=HYPERLINK("https://invalid")'), '"\'=HYPERLINK(""https://invalid"")"');
  assert.equal(csvCell(-4.5), '"-4.5"');
});
