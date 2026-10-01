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
  corsOrigin: process.env.CORS_ORIGIN || (nodeEnv === 'production' ? undefined : 'http://localhost:5173'),
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
  appPublicUrl: process.env.APP_PUBLIC_URL || '',
  emailEnabled: process.env.EMAIL_ENABLED === 'true'
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
if (config.emailEnabled && (!config.resendApiKey || !config.appPublicUrl)) {
  throw new Error('EMAIL_ENABLED requiere RESEND_API_KEY y APP_PUBLIC_URL');
}
if (config.emailEnabled) {
  let publicUrl;
  try { publicUrl = new URL(config.appPublicUrl); } catch { throw new Error('APP_PUBLIC_URL debe ser una URL HTTP/HTTPS válida'); }
  if (!['http:', 'https:'].includes(publicUrl.protocol) || (nodeEnv === 'production' && publicUrl.protocol !== 'https:')) {
    throw new Error('APP_PUBLIC_URL debe usar HTTPS en producción');
  }
}

module.exports = config;
