require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv !== 'test' && !process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI es obligatorio fuera del entorno de pruebas.');
}

if (nodeEnv !== 'test' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio fuera del entorno de pruebas.');
}

module.exports = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv,
  jwtSecret: process.env.JWT_SECRET || 'test-only-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  mongoUri: process.env.MONGODB_URI || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
};