const test = require('node:test');
const assert = require('node:assert/strict');
const { validateIntegrationConfig } = require('../src/utils/integrationConfig');

test('INT-CFG-001: acepta configuraciones públicas simples y acotadas', () => {
  const config = { environment: 'sandbox', region: 'mx', accountLabel: 'Cuenta principal', options: { retries: 3, active: true } };
  assert.equal(validateIntegrationConfig(config), config);
});

test('INT-CFG-002: rechaza claves sensibles en cualquier nivel e independientemente de mayúsculas/separadores', () => {
  for (const key of ['apiKey', 'API_KEY', 'password', 'Password', 'clientSecret', 'ACCESS_TOKEN', 'refresh-token', 'privateKey', 'MONGODB_URI', 'JWT_SECRET', 'custom_apiKey_value']) {
    assert.throws(() => validateIntegrationConfig({ nested: { [key]: 'redacted' } }), error => error.errorCode === 'SENSITIVE_CONFIG_REJECTED', key);
  }
});

test('INT-CFG-003: limita forma, profundidad y tamaño de configuración', () => {
  assert.throws(() => validateIntegrationConfig([]), /objeto/);
  assert.throws(() => validateIntegrationConfig({ value: 'x'.repeat(5000) }), /4 KB/);
  let deep = { value: true }; for (let index = 0; index < 7; index += 1) deep = { nested: deep };
  assert.throws(() => validateIntegrationConfig(deep), /demasiados niveles/);
});
