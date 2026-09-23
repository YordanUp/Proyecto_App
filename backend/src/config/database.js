const mongoose = require('mongoose');

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_dev';

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });

    console.log('MongoDB conectado correctamente');
    return mongoose.connection;
  } catch (error) {
    console.error('Error conectando a MongoDB:', error.message);
    throw error;
  }
}

module.exports = { connectDatabase };
