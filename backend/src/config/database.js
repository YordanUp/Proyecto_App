const mongoose = require('mongoose');
const config = require('./config');

async function connectDatabase() {
  if (!config.mongoUri) throw new Error('MONGODB_URI es obligatorio; no se usa una base local automáticamente');
  mongoose.set('strictQuery', true);
  mongoose.set('autoIndex', config.nodeEnv !== 'production');

  try {
    await mongoose.connect(config.mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10000,
      autoIndex: config.nodeEnv !== 'production'
    });

    console.log('MongoDB conectado correctamente');
    return mongoose.connection;
  } catch (error) {
    throw new Error(`No fue posible conectar a MongoDB: ${error.message}`, { cause: error });
  }
}

function disconnectDatabase() {
  return mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase, mongoose };
