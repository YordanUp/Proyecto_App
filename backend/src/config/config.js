require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Falta la variable de entorno requerida: ${name}`);
  return value;
}

const nodeEnv = process.env.NODE_ENV || (process.env.NODE_TEST_CONTEXT ? 'test' : 'development');
const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv,
  jwtSecret: required('JWT_SECRET', nodeEnv === 'test' ? 'test-only-secret-not-for-production' : undefined),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  mongoUri: process.env.MONGODB_URI || null,
  corsOrigin: process.env.CORS_ORIGIN || (nodeEnv === 'production' ? undefined : 'http://localhost:5173')
};

if (!config.mongoUri && nodeEnv !== 'test') {
  throw new Error('Falta la variable de entorno requerida: MONGODB_URI');
}

if (config.jwtSecret.length < 32 && nodeEnv !== 'test') {
  throw new Error('JWT_SECRET debe contener al menos 32 caracteres');
}
if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('PORT debe ser un puerto válido entre 1 y 65535');
if (!config.corsOrigin) throw new Error('Falta CORS_ORIGIN en producción');
if (nodeEnv === 'production' && config.corsOrigin.split(',').some(origin => origin.trim() === '*')) {
  throw new Error('CORS_ORIGIN no puede usar comodín en producción');
}

module.exports = config;
