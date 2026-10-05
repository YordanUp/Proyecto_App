const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchCollection } = require('../src/services/resourceService');
const catalogs = require('../src/constants/catalogs');

async function verifiesCollection(t, endpoint, record, options = {}) {
  let requestedPath;
  const result = await fetchCollection(async path => {
    requestedPath = path;
    return { success: true, data: [record], pagination: { page: 1, limit: 50, total: 1, pages: 1 } };
  }, endpoint, options);
  assert.match(requestedPath, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(requestedPath, /limit=50/);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0], record);
}

test('MOB-008: productos se consultan desde el endpoint persistente existente', async t => {
  assert.equal(catalogs.products.endpoint, '/api/products');
  await verifiesCollection(t, catalogs.products.endpoint, { id: 'p1', name: 'Producto' }, { search: 'producto' });
});

test('MOB-009: clientes se consultan desde el endpoint persistente existente', async t => {
  assert.equal(catalogs.clients.endpoint, '/api/clients');
  await verifiesCollection(t, catalogs.clients.endpoint, { id: 'c1', name: 'Cliente' });
});

test('Catálogos: almacenes reutiliza su endpoint persistente', async t => {
  assert.equal(catalogs.warehouses.endpoint, '/api/warehouses');
  await verifiesCollection(t, catalogs.warehouses.endpoint, { id: 'w1', name: 'Central' });
});

test('Catálogos seleccionables apuntan a recursos persistentes existentes', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(catalogs).map(([key, item]) => [key, item.endpoint])), {
    products: '/api/products', clients: '/api/clients', suppliers: '/api/suppliers', warehouses: '/api/warehouses', categories: '/api/categories'
  });
});
