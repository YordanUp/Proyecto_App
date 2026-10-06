const FORBIDDEN_CONFIG_KEYS = new Set([
  'apikey', 'secret', 'clientsecret', 'password', 'token', 'accesstoken',
  'refreshtoken', 'privatekey', 'mongodburi', 'jwtsecret'
]);

function integrationError(statusCode, errorCode, message) {
  return Object.assign(new Error(message), { statusCode, errorCode });
}

function validateIntegrationConfig(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw integrationError(400, 'VALIDATION_ERROR', 'La configuración debe ser un objeto de datos no sensibles');
  }
  let size;
  try { size = Buffer.byteLength(JSON.stringify(value), 'utf8'); }
  catch { throw integrationError(400, 'VALIDATION_ERROR', 'La configuración no es válida'); }
  if (size > 4096) throw integrationError(400, 'VALIDATION_ERROR', 'La configuración no puede superar 4 KB');

  function inspect(input, depth = 0) {
    if (depth > 5) throw integrationError(400, 'VALIDATION_ERROR', 'La configuración tiene demasiados niveles');
    if (input === null || ['string', 'number', 'boolean'].includes(typeof input)) return;
    if (Array.isArray(input)) {
      if (input.length > 100) throw integrationError(400, 'VALIDATION_ERROR', 'La configuración contiene demasiados valores');
      input.forEach(item => inspect(item, depth + 1));
      return;
    }
    if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) throw integrationError(400, 'VALIDATION_ERROR', 'La configuración solo acepta valores JSON simples');
    for (const [key, child] of Object.entries(input)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if ([...FORBIDDEN_CONFIG_KEYS].some(forbidden => normalized.includes(forbidden))) {
        throw integrationError(400, 'SENSITIVE_CONFIG_REJECTED', `La clave de configuración "${key}" puede contener información sensible`);
      }
      inspect(child, depth + 1);
    }
  }
  inspect(value);
  return value;
}

module.exports = { FORBIDDEN_CONFIG_KEYS, integrationError, validateIntegrationConfig };
