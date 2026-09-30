require('dotenv').config();
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { mongoose } = require('../src/config/database');
const { ensureInitialAdmin } = require('../src/services/bootstrapService');

async function main() {
  await connectDatabase();
  try {
    await ensureInitialAdmin();
  } finally { await disconnectDatabase(); }
}

main().catch(async error => { console.error(error.message); if (mongoose.connection.readyState) await disconnectDatabase(); process.exitCode = 1; });
