const test = require('node:test');
const assert = require('node:assert/strict');
const { login, restoreSession, logout } = require('../src/services/authFlow');
const { hasPermission } = require('../src/services/permissions');
const { ApiError, apiRequest, userMessage } = require('../src/api/client');

function fakeStore(token = null) {
  return {
    token,
    saved: [],
    cleared: 0,
    async getToken() { return this.token; },
    async saveToken(value) { this.token = value; this.saved.push(value); },
    async clearToken() { this.token = null; this.cleared += 1; }
  };
}

test('MOB-001/003: login válido guarda el JWT y entra con el usuario del backend', async () => {
  const store = fakeStore();
  const user = { id: 'user-1', name: 'Ana', role: 'admin', permissions: ['dashboard.read'] };
  const result = await login('ana@example.com', 'no-guardar-esta-clave', {
    store,
    request: async (path, options) => {
      assert.equal(path, '/api/auth/login');
      assert.equal(options.method, 'POST');
      assert.deepEqual(options.body, { email: 'ana@example.com', password: 'no-guardar-esta-clave' });
      return { data: { token: 'jwt-test', user } };
    }
  });
  assert.equal(result.token, 'jwt-test');
  assert.equal(result.user, user);
  assert.equal(store.token, 'jwt-test');
  assert.deepEqual(store.saved, ['jwt-test']);
});

test('MOB-002: login inválido conserva la respuesta de error y no guarda token', async () => {
  const store = fakeStore();
  await assert.rejects(login('ana@example.com', 'incorrecta', {
    store,
    request: async () => { throw new ApiError('Credenciales inválidas', { status: 401, code: 'INVALID_CREDENTIALS' }); }
  }), error => error.status === 401);
  assert.equal(store.token, null);
  assert.equal(store.saved.length, 0);
});

test('MOB-003: token guardado se valida contra /api/auth/me y restaura la sesión', async () => {
  const store = fakeStore('jwt-saved');
  const user = { id: 'user-2', name: 'Luis', permissions: ['products.read'] };
  const result = await restoreSession({
    store,
    request: async (path, options) => {
      assert.equal(path, '/api/auth/me');
      assert.equal(options.token, 'jwt-saved');
      return { data: user };
    }
  });
  assert.equal(result.status, 'signedIn');
  assert.equal(result.user, user);
});

test('MOB-004: token inválido se borra y la app regresa a sesión cerrada', async () => {
  const store = fakeStore('jwt-expired');
  const result = await restoreSession({ store, request: async () => { throw new ApiError('Token inválido', { status: 401, code: 'INVALID_TOKEN' }); } });
  assert.equal(result.status, 'signedOut');
  assert.equal(store.token, null);
  assert.equal(store.cleared, 1);
});

test('MOB-005: logout borra el token aunque el endpoint remoto falle', async () => {
  const store = fakeStore('jwt-saved');
  await assert.rejects(logout({ store, token: 'jwt-saved', request: async () => { throw new Error('offline'); } }), /offline/);
  assert.equal(store.token, null);
  assert.equal(store.cleared, 1);
});

test('MOB-006: backend no disponible produce un error controlado', async t => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => { throw new Error('network down'); };
  await assert.rejects(apiRequest('/api/health', { timeoutMs: 100 }), error => error.code === 'NETWORK_ERROR' && error.status === 0);
  const store = fakeStore('jwt-kept-offline');
  const result = await restoreSession({ store, request: async () => { throw new ApiError('offline'); } });
  assert.equal(result.status, 'offline');
  assert.equal(store.token, 'jwt-kept-offline');
});

test('MOB-007: la UI puede ocultar acciones que el usuario no tiene autorizadas', () => {
  const user = { permissions: ['sales.read', 'inventory.read'] };
  assert.equal(hasPermission(user, 'sales.create'), false);
  assert.equal(hasPermission(user, 'inventory.adjust'), false);
  assert.equal(hasPermission(user, 'sales.read'), true);
});

test('MOB-AUTH-004: respuesta 401 solicita borrar el token local', async t => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  let cleared = 0;
  global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ success: false, message: 'Token expirado', error: 'INVALID_TOKEN' }) });
  await assert.rejects(apiRequest('/api/auth/me', { onUnauthorized: async () => { cleared += 1; } }), error => error.status === 401);
  assert.equal(cleared, 1);
});

test('MOB-AUTH-011: correo sin verificar muestra el mensaje específico del backend', () => {
  const error = new ApiError('Verifica tu correo antes de ingresar.', { status: 403, code: 'EMAIL_NOT_VERIFIED' });
  assert.equal(userMessage(error), 'Verifica tu correo antes de ingresar.');
});

test('MOB-API-001: una lectura reintenta una sola vez al despertar el backend', async t => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return calls === 1
      ? { ok: false, status: 503, json: async () => ({ success: false, error: 'STARTING' }) }
      : { ok: true, status: 200, json: async () => ({ success: true, data: [] }) };
  };
  assert.deepEqual(await apiRequest('/api/health', { timeoutMs: 1000 }), { success: true, data: [] });
  assert.equal(calls, 2);
});

test('MOB-API-002: no reintenta operaciones POST y conserva mensajes del backend', async t => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  let calls = 0;
  global.fetch = async () => { calls += 1; return { ok: false, status: 409, json: async () => ({ success: false, message: 'Stock insuficiente', error: 'INSUFFICIENT_STOCK' }) }; };
  await assert.rejects(apiRequest('/api/inventory/exit', { method: 'POST', body: { quantity: 1 } }), error => {
    assert.equal(userMessage(error), 'Stock insuficiente');
    return error.status === 409;
  });
  assert.equal(calls, 1);
  assert.equal(userMessage(new ApiError('Rate limit', { status: 429 })), 'Rate limit');
});
