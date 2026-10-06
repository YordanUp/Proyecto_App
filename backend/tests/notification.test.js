process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Notification = require('../src/models/Notification');
const service = require('../src/services/notificationService');

test('NOT-MODEL-001: notification requiere usuario, contenido y estados válidos', async () => {
  const item = new Notification({ userId: new mongoose.Types.ObjectId(), type: 'sales.confirmed', title: 'Venta', message: 'Confirmada', module: 'sales' });
  await item.validate();
  assert.equal(item.status, 'unread');
  assert.equal(item.priority, 'normal');
  assert.equal(Notification.schema.options.timestamps, true);
  const invalid = new Notification({ userId: new mongoose.Types.ObjectId(), type: 'x', title: 'x', message: 'x', module: 'x', status: 'pending', priority: 'urgent' });
  const error = await invalid.validate().catch(value => value);
  assert.ok(error.errors.status);
  assert.ok(error.errors.priority);
});

test('NOT-MODEL-002: índices soportan bandeja propia y unread count', () => {
  const indexes = Notification.schema.indexes();
  assert.ok(indexes.some(([fields]) => fields.userId === 1 && fields.createdAt === -1));
  assert.ok(indexes.some(([fields]) => fields.userId === 1 && fields.status === 1));
});

test('NOT-VAL-001: servicio limita metadata, contenido y prioridad', () => {
  assert.throws(() => service.normalize({ title: ' ', message: 'x' }), error => error.statusCode === 400 && error.errorCode === 'VALIDATION_ERROR');
  assert.throws(() => service.normalize({ title: 'x', message: 'x', priority: 'urgent' }), error => error.statusCode === 400);
  assert.throws(() => service.normalize({ title: 'x', message: 'x', metadata: { large: 'x'.repeat(3000) } }), error => error.statusCode === 400);
  assert.equal(service.normalize({ title: 'x', message: 'x', metadata: { folio: 'VEN-001' } }).metadata.folio, 'VEN-001');
});
