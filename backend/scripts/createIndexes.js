require('dotenv').config();
const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
require('../src/models/User');
require('../src/models/Role');
require('../src/models/AuditLog');
require('../src/models/catalog');

async function main() {
  await connectDatabase();
  try {
    for (const modelName of mongoose.modelNames()) {
      await mongoose.model(modelName).createIndexes();
      console.log(`Índices verificados: ${modelName}`);
    }
  } finally { await disconnectDatabase(); }
}
main().catch(async error => { console.error(error.message); if (mongoose.connection.readyState) await disconnectDatabase(); process.exitCode = 1; });
