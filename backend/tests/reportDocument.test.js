const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Packer } = require('docx');
const JSZip = require('jszip');
const { xml2js } = require('xml-js');
const {
  buildDocument,
  formatProductText,
  groupProducts,
  groupSalesByCustomer,
  groupPurchasesBySupplier,
  salesSummaryRows,
  purchaseSummaryRows,
  reportFilename,
  MAX_DOCX_EXPORT_LIMIT
} = require('../src/services/reportDocumentService');

test('DOCX-007: document product formatter includes populated names and codes', () => {
  assert.equal(formatProductText({ product: { name: 'Veladoras', code: '7004' }, quantity: 5, unitPrice: 15 }, 'sales'), 'Veladoras (7004) — 5 × $15.00');
});

test('DOCX-008: document product formatter returns human text instead of JSON', () => {
  const line = formatProductText({ product: null, productNameSnapshot: 'Guanteras', skuSnapshot: '7001', quantity: 2, unitCost: 500 }, 'purchases');
  assert.equal(line, 'Guanteras (7001) — 2 × $500.00');
  assert.equal(line.includes('{'), false);
  assert.equal(line.includes('product:'), false);
});

test('DOCX-009: document product formatter never falls back to a product ObjectId', () => {
  const line = formatProductText({ product: '507f1f77bcf86cd799439011', quantity: 1, unitPrice: 8 }, 'sales');
  assert.equal(line, 'Producto — 1 × $8.00');
  assert.equal(line.includes('507f1f77bcf86cd799439011'), false);
});

test('DOCX report grouping uses client, supplier, and product snapshot values', () => {
  const sales = [{ customer: { name: 'Cliente A' }, status: 'confirmed', grossTotal: 100, returnedTotal: 10, netTotal: 90, items: [{ product: null, productNameSnapshot: 'Artículo A', skuSnapshot: 'A-1', quantity: 2, unitPrice: 50, subtotal: 100 }] }];
  const purchases = [{ supplier: { name: 'Proveedor A' }, total: 80, items: [{ product: null, productNameSnapshot: 'Artículo A', skuSnapshot: 'A-1', quantity: 2, unitCost: 40, subtotal: 80 }] }];
  assert.deepEqual(groupSalesByCustomer(sales).map(row => [row.name, row.operations, row.gross, row.returned, row.net]), [['Cliente A', 1, 100, 10, 90]]);
  assert.deepEqual(groupPurchasesBySupplier(purchases).map(row => [row.name, row.operations, row.total]), [['Proveedor A', 1, 80]]);
  assert.deepEqual(groupProducts(sales, 'sales').map(row => [row.name, row.code, row.quantity, row.amount]), [['Artículo A', 'A-1', 2, 100]]);
});

test('DOCX-005: sales summary uses the report API gross, returns, and net totals unchanged', () => {
  assert.deepEqual(salesSummaryRows({ grossTotal: 500, returnsTotal: 30, netTotal: 470 }, 1), [
    ['Ventas confirmadas', '1'], ['Ventas brutas', '$500.00'], ['Devoluciones', '$30.00'], ['Ventas netas', '$470.00']
  ]);
});

test('DOCX-006: purchase summary uses the report API totals and supplier grouping', () => {
  assert.deepEqual(purchaseSummaryRows({ recordCount: 2, subtotal: 100, taxes: 16, total: 116 }), [
    ['Compras encontradas', '2'], ['Subtotal', '$100.00'], ['Impuestos', '$16.00'], ['Total comprado', '$116.00']
  ]);
});

test('DOCX sales and purchases exports are valid Word ZIP/XML documents with readable content', async () => {
  const tempPath = path.join(__dirname, '..', 'tmp', 'report-word-validation.docx');
  await fs.mkdir(path.dirname(tempPath), { recursive: true });
  const fixtures = [
    {
      type: 'sales',
      items: [{ folio: 'V-TEST-01', status: 'confirmed', confirmedAt: '2026-10-01T12:00:00.000Z', customer: { name: 'Cliente Exportación' }, grossTotal: 500, returnedTotal: 20, netTotal: 480, items: [{ product: { name: 'Guanteras históricas', code: 'G-500' }, quantity: 1, unitPrice: 500 }] }],
      totals: { recordCount: 1, grossTotal: 500, returnsTotal: 20, netTotal: 480 },
      expected: ['Reporte de Ventas', 'Cliente Exportación', 'Guanteras históricas', 'V-TEST-01', '$500.00']
    },
    {
      type: 'purchases',
      items: [{ folio: 'C-TEST-01', createdAt: '2026-10-10T12:00:00.000Z', supplier: { name: 'Proveedor Exportación' }, subtotal: 400, taxes: 64, total: 464, items: [{ product: { name: 'Producto de compra', code: 'P-464' }, quantity: 2, unitCost: 200 }] }],
      totals: { recordCount: 1, subtotal: 400, taxes: 64, total: 464 },
      expected: ['Reporte de Compras', 'Proveedor Exportación', 'Producto de compra', 'C-TEST-01', '$464.00']
    }
  ];

  try {
    for (const fixture of fixtures) {
      const document = buildDocument(fixture.type, fixture.items, fixture.totals, { from: '2026-10-01', to: '2026-10-31' }, new Date('2026-10-31T12:00:00.000Z'));
      const buffer = await Packer.toBuffer(document);
      assert.equal(buffer.subarray(0, 4).toString('hex'), '504b0304');
      await fs.writeFile(tempPath, buffer);

      const zip = await JSZip.loadAsync(await fs.readFile(tempPath));
      assert.ok(zip.file('[Content_Types].xml'));
      assert.ok(zip.file('word/document.xml'));
      assert.ok(zip.file('_rels/.rels'));

      for (const entry of Object.values(zip.files).filter(file => !file.dir && (/\.xml$|\.rels$/).test(file.name))) {
        const xml = await entry.async('string');
        assert.doesNotThrow(() => xml2js(xml), `XML inválido en ${entry.name}`);
        assert.doesNotMatch(xml, /\[object Object\]|"product"\s*:/);
      }

      const documentXml = await zip.file('word/document.xml').async('string');
      const parsed = xml2js(documentXml, { compact: true });
      const collectText = node => {
        if (!node || typeof node !== 'object') return [];
        return [ ...(typeof node._text === 'string' ? [node._text] : []), ...Object.values(node).flatMap(collectText) ];
      };
      const text = collectText(parsed).join(' ');
      for (const expected of fixture.expected) assert.ok(text.includes(expected), `${fixture.type} no contiene ${expected}`);
      assert.doesNotMatch(text, /\[object Object\]|"product"\s*:/);
    }
  } finally {
    await fs.rm(tempPath, { force: true });
  }
});

test('DOCX export filenames include a sanitized period and export limit is bounded', () => {
  assert.equal(reportFilename('sales', { from: '2026-10-01', to: '2026-10-31' }), 'reporte-ventas-2026-10-01-a-2026-10-31.docx');
  assert.equal(MAX_DOCX_EXPORT_LIMIT, 2000);
});

test('DOCX only supports sales and purchases', () => {
  assert.throws(() => buildDocument('inventory-stock', [], {}, {}), { statusCode: 400, errorCode: 'UNSUPPORTED_REPORT_EXPORT' });
});
