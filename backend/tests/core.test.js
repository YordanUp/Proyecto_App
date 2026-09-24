process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Role = require('../src/models/Role');
const { Product } = require('../src/models/catalog');
const { hashPassword, verifyPassword } = require('../src/services/authService');
const { errorHandler } = require('../src/middleware/errorHandler');

test('User requiere nombre, correo, hash y rol; nunca serializa el hash', () => {
  const user = new User({ name: 'A', email: 'not-an-email', passwordHash: 'hash' });
  const error = user.validateSync();
  assert.ok(error.errors.name);
  assert.ok(error.errors.role);
  assert.equal(user.toJSON().passwordHash, undefined);
});

test('Role rechaza permisos duplicados', () => {
  const role = new Role({ name: 'operador', permissions: ['products.read', 'products.read'] });
  assert.ok(role.validateSync().errors.permissions);
});

test('Product rechaza precio de venta menor al de compra', async () => {
  const product = new Product({ code: 'P-1', name: 'Producto', categoryId: new mongoose.Types.ObjectId(), purchasePrice: 100, salePrice: 50 });
  await assert.rejects(product.validate(), error => Boolean(error.errors.salePrice));
});

test('Las contraseñas se guardan como hash y se pueden verificar', async () => {
  const password = 'una-clave-segura-larga';
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('incorrecta', hash), false);
});

test('Los errores de duplicado Mongo se traducen sin filtrar el mensaje interno', () => {
  let status;
  let payload;
  const response = { status(code) { status = code; return this; }, json(body) { payload = body; return body; } };
  errorHandler({ code: 11000, message: 'duplicate key secret database detail' }, {}, response, () => {});
  assert.equal(status, 409);
  assert.deepEqual(payload, { success: false, message: 'Ya existe un registro con esos datos', error: 'DUPLICATE_RECORD' });
});
