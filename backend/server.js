require('dotenv').config();

const app = require('./src/app');
const config = require('./src/config/config');
const { connectDatabase, disconnectDatabase, mongoose } = require('./src/config/database');

async function start() {
  await connectDatabase();
  const server = app.listen(config.port, () => console.log(`ERP backend running on port ${config.port}`));

  async function shutdown(signal) {
    console.log(`${signal}: cerrando servidor`);
    server.close(async () => {
      try { await disconnectDatabase(); process.exit(0); }
      catch (error) { console.error('Error cerrando MongoDB:', error.message); process.exit(1); }
    });
  }
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  mongoose.connection.on('disconnected', () => console.error('Conexión MongoDB perdida'));
  mongoose.connection.on('reconnected', () => console.info('Conexión MongoDB restablecida'));
  mongoose.connection.on('error', error => console.error('Error de conexión MongoDB:', error.message));
  return server;
}

if (require.main === module) {
  start().catch(error => { console.error(error.message); process.exit(1); });
}

module.exports = { start };
