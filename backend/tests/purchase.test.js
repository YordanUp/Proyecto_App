process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Purchase = require('../src/models/Purchase');
const purchaseService = require('../src/services/purchaseService');

function base(quantity) {
  return {
    folio: 'COM-2026-000001', supplier: new mongoose.Types.ObjectId(), createdBy: new mongoose.Types.ObjectId(),
    items: [{ product: new mongoose.Types.ObjectId(), warehouse: new mongoose.Types.ObjectId(), productNameSnapshot: 'Producto', quantity, unitCost: 10, taxRate: 0, tax: 0, subtotal: 10, total: 10 }],
    subtotal: 10, taxes: 0, total: 10, status: 'draft'
  };
}

test('NUM-API-005: compra requiere cantidad entera mayor o igual a uno', async () => {
  for (const quantity of [0, -1, 0.5, 0.000001, 1.5]) {
    const values = base(quantity);
    await assert.rejects(new Purchase(values).validate(), error => error.errors['items.0.quantity']?.message === 'La cantidad debe ser un número entero mayor o igual a 1.');
    await assert.rejects(
      purchaseService.createPurchase({ supplierId: values.supplier, items: [{ productId: values.items[0].product, warehouseId: values.items[0].warehouse, quantity }] }, values.createdBy),
      error => error.statusCode === 400 && error.errorCode === 'VALIDATION_ERROR' && error.message === 'La cantidad debe ser un número entero mayor o igual a 1.'
    );
  }
  await new Purchase(base(1)).validate();
});
