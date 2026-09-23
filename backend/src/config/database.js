const mongoose = require('mongoose');
const config = require('./config');

async function connectDatabase() {
  if (!config.mongoUri) {
    throw new Error('MONGODB_URI no está configurado.');
  }

  try {
    await mongoose.connect(config.mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });

    console.log(`MongoDB conectado correctamente: ${mongoose.connection.name}`);
    return mongoose.connection;
  } catch (error) {
    console.error('Error conectando a MongoDB:', error.message);
    throw error;
  }
}

function getDatabaseStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    name: mongoose.connection.name || null
  };
}

module.exports = { connectDatabase, getDatabaseStatus };