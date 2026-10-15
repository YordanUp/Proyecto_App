process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Quotation = require('../src/models/Quotation');
const service = require('../src/services/quotationService');

const base = () => ({
  folio: 'COT-2026-000001', customerId: new mongoose.Types.ObjectId(), createdBy: new mongoose.Types.ObjectId(),
  items: [{ product: new mongoose.Types.ObjectId(), warehouse: new mongoose.Types.ObjectId(), productNameSnapshot: 'Producto', quantity: 1, unitPrice: 100, taxRate: 16, subtotal: 100, tax: 16, total: 116 }],
  subtotal: 100, taxes: 16, total: 116
});

test('QUO-MODEL-001: persiste estados permitidos, referencias, snapshots y fechas', async () => {
  const quotation = new Quotation({ ...base(), status: 'accepted', sentAt: new Date(), acceptedAt: new Date() });
  await quotation.validate();
  assert.equal(quotation.status, 'accepted');
  assert.equal(quotation.items[0].productNameSnapshot, 'Producto');
  assert.ok(Quotation.schema.path('saleId'));
  assert.equal(Quotation.schema.options.timestamps, true);
});

test('QUO-MODEL-002: rechaza estado desconocido, cantidades inválidas y líneas vacías', async () => {
  await assert.rejects(new Quotation({ ...base(), status: 'confirmed' }).validate(), error => Boolean(error.errors.status));
  await assert.rejects(new Quotation({ ...base(), items: [{ ...base().items[0], quantity: 0 }] }).validate(), error => Boolean(error.errors['items.0.quantity']));
  await assert.rejects(new Quotation({ ...base(), items: [] }).validate(), error => Boolean(error.errors.items));
});

test('QUO-MODEL-003: folio tiene índice único y hay índices para estado y cliente', () => {
  const indexes = Quotation.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.folio === 1 && options.unique));
  assert.ok(indexes.some(([fields]) => fields.status === 1 && fields.createdAt === -1));
  assert.ok(indexes.some(([fields]) => fields.customerId === 1 && fields.createdAt === -1));
});

test('QUO-API-001: identificador inválido se rechaza antes de consultar MongoDB', async () => {
  await assert.rejects(service.getQuotationById('invalid'), error => error.statusCode === 400 && error.errorCode === 'VALIDATION_ERROR');
});

test('NUM-API-006: cotización rechaza cantidades fraccionarias o menores a uno antes de MongoDB', async () => {
  const actorId = new mongoose.Types.ObjectId();
  for (const quantity of [0, -1, 0.5, 0.000001, 1.5]) {
    await assert.rejects(
      service.createQuotation({ customerId: base().customerId, items: [{ productId: base().items[0].product, warehouseId: base().items[0].warehouse, quantity }] }, actorId),
      error => error.statusCode === 400 && error.errorCode === 'VALIDATION_ERROR' && error.message === 'La cantidad debe ser un número entero mayor o igual a 1.'
    );
    await assert.rejects(new Quotation({ ...base(), items: [{ ...base().items[0], quantity }] }).validate(), error => Boolean(error.errors['items.0.quantity']));
  }
  await new Quotation(base()).validate();
});
