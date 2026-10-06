const test = require('node:test');
const assert = require('node:assert/strict');
const SystemSetting = require('../src/models/SystemSetting');
const settingsService = require('../src/services/settingsService');

test('SET-MODEL-001: key es única y schema usa timestamps y tipos admitidos', async () => {
  assert.equal(SystemSetting.schema.options.timestamps, true);
  assert.ok(SystemSetting.schema.indexes().some(([fields, options]) => fields.key === 1 && options.unique));
  await assert.rejects(new SystemSetting({ key: 'JWT_SECRET', label: 'Secret', value: 'secret', type: 'text', category: 'general' }).validate(), /is not a valid enum value/);
  await new SystemSetting({ key: 'company_name', label: 'Empresa', value: true, type: 'boolean', category: 'general' }).validate();
  await assert.rejects(new SystemSetting({ key: 'company_name', label: 'Empresa', value: 'Nombre', type: 'currency', category: 'general' }).validate(), /is not a valid enum value/);
});

test('SET-VAL-001: valida key y restricciones por valor sin manejar secretos', () => {
  assert.equal(settingsService.validateValue('company_name', ' Empresa '), 'Empresa');
  assert.equal(settingsService.validateValue('currency', 'USD'), 'USD');
  assert.equal(settingsService.validateValue('timezone', 'UTC'), 'UTC');
  assert.equal(settingsService.validateValue('date_format', 'YYYY-MM-DD'), 'YYYY-MM-DD');
  for (const [key, value] of [['currency', 'CAD'], ['timezone', 'UTC-5'], ['date_format', 'DD-MM-YYYY'], ['company_name', '   '], ['JWT_SECRET', 'nope']]) {
    assert.throws(() => settingsService.validateValue(key, value), error => error.statusCode === (key === 'JWT_SECRET' ? 404 : 400));
  }
});
