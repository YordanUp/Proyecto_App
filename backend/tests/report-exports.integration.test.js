require('dotenv').config();
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const mongoose = require('mongoose');
const testUri = process.env.TEST_MONGODB_URI;
if (testUri) {
  const isolated = new URL(testUri);
  isolated.pathname = `/rptdocx_${process.pid}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  process.env.MONGODB_URI = isolated.toString();
}
const app = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Role = require('../src/models/Role');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const Sale = require('../src/models/Sale');
const SalesReturn = require('../src/models/SalesReturn');
const Purchase = require('../src/models/Purchase');
const { Category, Product, Client, Supplier, Warehouse } = require('../src/models/catalog');
const { hashPassword } = require('../src/services/authService');

function parseBinary(response, callback) {
  const chunks = [];
  response.on('data', chunk => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
}

test('Report export integration: readable CSV and filtered sales/purchases DOCX with RBAC and audit', {
  skip: testUri ? false : 'Define TEST_MONGODB_URI con una base desechable compatible con transacciones'
}, async t => {
  await connectDatabase();
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
  t.after(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });

  const role = await Role.create({ name: `report-export-${process.pid}`, permissions: ['reports.read'] });
  const user = await User.create({ name: 'Lectura reportes', email: `report-export-${process.pid}@test.invalid`, passwordHash: await hashPassword('clave-export-reportes-larga'), role: role.id });
  const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'clave-export-reportes-larga' });
  assert.equal(login.status, 200);
  const auth = { Authorization: `Bearer ${login.body.data.token}` };

  const category = await Category.create({ name: `Reportes-${process.pid}` });
  const customer = await Client.create({ name: 'Cliente Exportación' });
  const supplier = await Supplier.create({ name: 'Proveedor Exportación' });
  const product = await Product.create({ code: `EXP-${process.pid}`, name: 'Guanteras históricas', categoryId: category.id, purchasePrice: 200, salePrice: 500, minStock: 0 });
  const warehouse = await Warehouse.create({ name: `Almacén exportación-${process.pid}` });
  const sale = await Sale.create({
    folio: `VEN-EXP-${process.pid}`, customer: customer.id,
    items: [{ product: product.id, warehouse: warehouse.id, productNameSnapshot: 'Guanteras históricas', skuSnapshot: product.code, quantity: 1, unitPrice: 500, taxRate: 0, tax: 0, subtotal: 500, total: 500 }],
    subtotal: 500, taxes: 0, total: 500, status: 'confirmed', createdBy: user.id,
    createdAt: new Date('2026-09-30T18:00:00.000Z'), confirmedAt: new Date('2026-10-01T12:00:00.000Z')
  });
  await SalesReturn.create({
    folio: `DEV-EXP-${process.pid}`, sale: sale.id, customer: customer.id,
    items: [{ saleLineIndex: 0, product: product.id, warehouse: warehouse.id, productNameSnapshot: 'Guanteras históricas', skuSnapshot: product.code, quantity: 0.04, unitPrice: 500, taxRate: 0, subtotal: 20, tax: 0, total: 20 }],
    reason: 'Prueba de reporte', status: 'processed', subtotal: 20, taxes: 0, total: 20, createdBy: user.id,
    processedAt: new Date('2026-10-02T12:00:00.000Z')
  });
  const purchase = await Purchase.create({
    folio: `COM-EXP-${process.pid}`, supplier: supplier.id,
    items: [{ product: product.id, warehouse: warehouse.id, productNameSnapshot: 'Guanteras históricas', skuSnapshot: product.code, quantity: 2, unitCost: 200, taxRate: 0, tax: 0, subtotal: 400, total: 400 }],
    subtotal: 400, taxes: 0, total: 400, status: 'received', createdBy: user.id,
    createdAt: new Date('2026-10-10T12:00:00.000Z'), receivedAt: new Date('2026-10-11T12:00:00.000Z')
  });

  const salesCsv = await request(app).get('/api/reports/data/sales/export.csv').query({ from: '2026-10-01', to: '2026-10-31', customer: customer.id, search: sale.folio }).set(auth);
  assert.equal(salesCsv.status, 200);
  assert.ok(salesCsv.text.startsWith('\uFEFF'));
  assert.match(salesCsv.text, /Guanteras históricas \(EXP-\d+\) — 1 × \$500\.00/);
  assert.match(salesCsv.text, /"500"/);
  assert.match(salesCsv.text, /"20"/);
  assert.match(salesCsv.text, /"480"/);
  assert.doesNotMatch(salesCsv.text, /\{\s*"product"/);
  assert.doesNotMatch(salesCsv.text, /507f1f77bcf86cd799439011/);
  const purchasesCsv = await request(app).get('/api/reports/data/purchases/export.csv').query({ from: '2026-10-10', to: '2026-10-10', status: 'received', supplier: supplier.id, search: purchase.folio }).set(auth);
  assert.equal(purchasesCsv.status, 200);
  assert.match(purchasesCsv.text, /Guanteras históricas \(EXP-\d+\) — 2 × \$200\.00/);
  assert.doesNotMatch(purchasesCsv.text, /\{\s*"product"/);

  const salesReport = await request(app).get('/api/reports/data/sales').query({ from: '2026-10-01', to: '2026-10-31', status: 'confirmed', customer: customer.id, product: product.id, warehouse: warehouse.id, search: sale.folio }).set(auth);
  assert.equal(salesReport.status, 200);
  assert.equal(salesReport.body.totals.grossTotal, 500);
  assert.equal(salesReport.body.totals.returnsTotal, 20);
  assert.equal(salesReport.body.totals.netTotal, 480);

  const salesDocx = await request(app).get('/api/reports/data/sales/export.docx').query({ from: '2026-10-01', to: '2026-10-31', status: 'confirmed', customer: customer.id, product: product.id, warehouse: warehouse.id, search: sale.folio }).set(auth).buffer(true).parse(parseBinary);
  assert.equal(salesDocx.status, 200);
  assert.match(salesDocx.headers['content-type'], /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.match(salesDocx.headers['content-disposition'], /reporte-ventas-2026-10-01-a-2026-10-31\.docx/);
  assert.equal(salesDocx.body.subarray(0, 4).toString('hex'), '504b0304');
  const purchasesDocx = await request(app).get('/api/reports/data/purchases/export.docx').query({ from: '2026-10-10', to: '2026-10-10', status: 'received', supplier: supplier.id, product: product.id, warehouse: warehouse.id, search: purchase.folio }).set(auth).buffer(true).parse(parseBinary);
  assert.equal(purchasesDocx.status, 200);
  assert.match(purchasesDocx.headers['content-disposition'], /reporte-compras-2026-10-10-a-2026-10-10\.docx/);
  assert.equal(purchasesDocx.body.subarray(0, 4).toString('hex'), '504b0304');

  const unsupported = await request(app).get('/api/reports/data/inventory-stock/export.docx').set(auth);
  assert.equal(unsupported.status, 400);
  assert.equal(unsupported.body.error, 'UNSUPPORTED_REPORT_EXPORT');
  const audit = await AuditLog.find({ action: 'report.docx.exported', module: 'reports' }).lean();
  assert.equal(audit.length, 2);
  assert.equal(audit[0].after.format, 'docx');
  assert.equal(audit[0].after.filters.from, '2026-10-01');
  assert.equal(audit.find(entry => entry.recordId === 'sales').after.total, 1);
  assert.equal(audit.find(entry => entry.recordId === 'purchases').after.total, 1);

  const noReportRole = await Role.create({ name: `report-export-denied-${process.pid}`, permissions: [] });
  const noReportUser = await User.create({ name: 'Sin permisos reportes', email: `report-denied-${process.pid}@test.invalid`, passwordHash: await hashPassword('clave-sin-permiso-reportes'), role: noReportRole.id });
  const noReportLogin = await request(app).post('/api/auth/login').send({ email: noReportUser.email, password: 'clave-sin-permiso-reportes' });
  const denied = await request(app).get('/api/reports/data/sales/export.docx').set({ Authorization: `Bearer ${noReportLogin.body.data.token}` });
  assert.equal(denied.status, 403);
});
