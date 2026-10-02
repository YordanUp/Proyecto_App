process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const InventoryStock = require('../src/models/InventoryStock');
const InventoryMovement = require('../src/models/InventoryMovement');
const inventoryService = require('../src/services/inventoryService');

test('InventoryStock requiere referencias y no permite cantidades negativas', async () => {
  const stock = new InventoryStock({
    productId: new mongoose.Types.ObjectId(),
    warehouseId: new mongoose.Types.ObjectId(),
    quantity: -1,
    reservedQuantity: 0,
    minimumStock: 0
  });
  await assert.rejects(stock.validate(), error => Boolean(error.errors.quantity));
});

test('InventoryStock tiene unicidad por producto y almacén', () => {
  assert.ok(InventoryStock.schema.indexes().some(([fields, options]) => fields.productId === 1 && fields.warehouseId === 1 && options.unique));
});

test('InventoryMovement valida tipos, usuario, motivo y cantidades', async () => {
  const movement = new InventoryMovement({
    productId: new mongoose.Types.ObjectId(), warehouseId: new mongoose.Types.ObjectId(),
    type: 'UNKNOWN', quantity: -1, previousQuantity: 0, newQuantity: -1,
    reason: '', userId: new mongoose.Types.ObjectId()
  });
  const error = await movement.validate().catch(value => value);
  assert.ok(error.errors.type);
  assert.ok(error.errors.quantity);
  assert.ok(error.errors.newQuantity);
  assert.ok(error.errors.reason);
});

test('inventory API service rejects invalid identifiers and quantities before database access', async () => {
  await assert.rejects(inventoryService.addEntry({ productId: 'bad', warehouseId: 'bad', quantity: 1, reason: 'Test' }, new mongoose.Types.ObjectId()), error => error.statusCode === 400 && error.errorCode === 'VALIDATION_ERROR');
  const id = new mongoose.Types.ObjectId().toString();
  await assert.rejects(inventoryService.addExit({ productId: id, warehouseId: id, quantity: 0, reason: 'Test' }, id), error => error.statusCode === 400 && error.errorCode === 'VALIDATION_ERROR');
  await assert.rejects(inventoryService.adjustStock({ productId: id, warehouseId: id, newQuantity: -1, reason: 'Test' }, id), error => error.statusCode === 400 && error.errorCode === 'VALIDATION_ERROR');
});
