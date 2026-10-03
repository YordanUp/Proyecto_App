const test = require('node:test');
const assert = require('node:assert/strict');
const catalogs = require('../src/constants/catalogs');
const { fetchCollection } = require('../src/services/resourceService');
const { statusActions, activateCatalogRecord, deactivateCatalogRecord, statusLabel } = require('../src/services/catalogStatusService');

function makeRequest(response = { success: true, data: { id: 'record-1', status: 'active' } }) {
  const calls = [];
  return {
    calls,
    request: async (path, options = {}) => { calls.push({ path, options }); return response; }
  };
}

test('MOB-CAT-001: catálogo muestra el estado inactivo con su etiqueta', () => {
  assert.equal(statusLabel('inactive'), 'Inactivo');
  assert.equal(statusLabel('active'), 'Activo');
});

test('MOB-CAT-002: desactiva producto por DELETE al confirmar la acción', async () => {
  const { request, calls } = makeRequest({ success: true, data: { id: 'p-1', status: 'inactive' } });
  const response = await deactivateCatalogRecord(request, catalogs.products, 'p-1');
  assert.equal(response.data.status, 'inactive');
  assert.deepEqual(calls, [{ path: '/api/products/p-1', options: { method: 'DELETE' } }]);
});

test('MOB-CAT-003: reactiva producto por PUT con status active', async () => {
  const { request, calls } = makeRequest();
  await activateCatalogRecord(request, catalogs.products, 'p-1');
  assert.deepEqual(calls, [{ path: '/api/products/p-1', options: { method: 'PUT', body: { status: 'active' } } }]);
});

test('MOB-CAT-004: desactiva proveedor por DELETE', async () => {
  const { request, calls } = makeRequest();
  await deactivateCatalogRecord(request, catalogs.suppliers, 's-1');
  assert.equal(calls[0].path, '/api/suppliers/s-1');
  assert.equal(calls[0].options.method, 'DELETE');
});

test('MOB-CAT-005: reactiva proveedor por PUT status active', async () => {
  const { request, calls } = makeRequest();
  await activateCatalogRecord(request, catalogs.suppliers, 's-1');
  assert.equal(calls[0].path, '/api/suppliers/s-1');
  assert.equal(calls[0].options.method, 'PUT');
  assert.deepEqual(calls[0].options.body, { status: 'active' });
});

test('MOB-CAT-006: cliente inactivo permite reactivación con clients.update y usa su endpoint', async () => {
  assert.deepEqual(statusActions({ permissions: ['clients.update'] }, catalogs.clients, { status: 'inactive' }), { canDeactivate: false, canActivate: true });
  const { request, calls } = makeRequest();
  await activateCatalogRecord(request, catalogs.clients, 'c-1');
  assert.deepEqual(calls[0], { path: '/api/clients/c-1', options: { method: 'PUT', body: { status: 'active' } } });
});

test('MOB-CAT-007: categoría activa se desactiva con categories.delete y el endpoint real', async () => {
  assert.deepEqual(statusActions({ permissions: ['categories.delete'] }, catalogs.categories, { status: 'active' }), { canDeactivate: true, canActivate: false });
  const { request, calls } = makeRequest();
  await deactivateCatalogRecord(request, catalogs.categories, 'cat-1');
  assert.deepEqual(calls[0], { path: '/api/categories/cat-1', options: { method: 'DELETE' } });
});

test('MOB-CAT-008: almacén inactivo se reactiva mediante el endpoint de almacenes', async () => {
  const { request, calls } = makeRequest();
  const actions = statusActions({ permissions: ['warehouses.update'] }, catalogs.warehouses, { status: 'inactive' });
  assert.equal(actions.canActivate, true);
  await activateCatalogRecord(request, catalogs.warehouses, 'w-1');
  assert.equal(calls[0].path, '/api/warehouses/w-1');
  assert.deepEqual(calls[0].options, { method: 'PUT', body: { status: 'active' } });
});

test('MOB-CAT-009: RBAC oculta activar y desactivar sin los permisos reales', () => {
  for (const [entity, definition] of Object.entries(catalogs)) {
    assert.deepEqual(statusActions({ permissions: [] }, definition, { status: 'active' }), { canDeactivate: false, canActivate: false }, entity);
    assert.deepEqual(statusActions({ permissions: [] }, definition, { status: 'inactive' }), { canDeactivate: false, canActivate: false }, entity);
  }
});

test('MOB-CAT-010: volver a enfocar o refrescar el catálogo vuelve a pedir datos al API', async () => {
  const results = [[{ id: 'p-1', status: 'active' }], [{ id: 'p-1', status: 'inactive' }]];
  const calls = [];
  const request = async path => {
    calls.push(path);
    return { data: results[calls.length - 1], pagination: { page: 1, limit: 50, total: 1, pages: 1 } };
  };
  const first = await fetchCollection(request, catalogs.products.endpoint, { page: 1, limit: 50 });
  const refreshed = await fetchCollection(request, catalogs.products.endpoint, { page: 1, limit: 50 });
  assert.equal(first.items[0].status, 'active');
  assert.equal(refreshed.items[0].status, 'inactive');
  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1]);
});
