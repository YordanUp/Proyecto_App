process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Sale = require('../src/models/Sale');
const salesService = require('../src/services/salesService');

test('Sale exige folio, cliente, usuario, items y estados permitidos', async () => {
  const sale = new Sale({
    folio: 'VEN-2026-000001', customer: new mongoose.Types.ObjectId(), createdBy: new mongoose.Types.ObjectId(),
    items: [{ product: new mongoose.Types.ObjectId(), warehouse: new mongoose.Types.ObjectId(), productNameSnapshot: 'Producto', quantity: 1, unitPrice: 10, tax: 0, subtotal: 10, total: 10 }],
    subtotal: 10, taxes: 0, total: 10, status: 'invalid'
  });
  const error = await sale.validate().catch(value => value);
  assert.ok(error.errors.status);
  assert.equal(Sale.schema.indexes().some(([fields, options]) => fields.folio === 1 && options.unique), true);
});

test('Sale rechaza artículos vacíos, cantidades no positivas y precio negativo', async () => {
  const base = { folio: 'VEN-2026-000002', customer: new mongoose.Types.ObjectId(), createdBy: new mongoose.Types.ObjectId(), subtotal: 0, taxes: 0, total: 0 };
  const empty = new Sale({ ...base, items: [] });
  await assert.rejects(empty.validate(), error => Boolean(error.errors.items));
  const invalidItem = new Sale({ ...base, items: [{ product: new mongoose.Types.ObjectId(), warehouse: new mongoose.Types.ObjectId(), productNameSnapshot: 'Producto', quantity: 0, unitPrice: -1, tax: 0, subtotal: 0, total: 0 }] });
  const error = await invalidItem.validate().catch(value => value);
  assert.ok(error.errors['items.0.quantity']);
  assert.ok(error.errors['items.0.unitPrice']);
});

test('Sales service rejects malformed identifiers and missing item lines before database access', async () => {
  await assert.rejects(salesService.createSale({ customerId: 'invalid', items: [] }, new mongoose.Types.ObjectId()), error => error.statusCode === 400 && error.errorCode === 'VALIDATION_ERROR');
  await assert.rejects(salesService.getSaleById('invalid'), error => error.statusCode === 400 && error.errorCode === 'VALIDATION_ERROR');
});
