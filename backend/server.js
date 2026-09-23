require('dotenv').config();

const app = require('./src/app');
const config = require('./src/config/config');
const { connectDatabase } = require('./src/config/database');

let server;

async function startServer() {
  try {
    await connectDatabase();

    server = app.listen(config.port, () => {
      console.log(`ERP backend running on port ${config.port}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el ERP:', error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`Recibida señal ${signal}. Cerrando ERP...`);

  if (server) {
    server.close(() => {
      console.log('Servidor HTTP cerrado');
    });
  }

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (require.main === module) {
  startServer();
}

module.exports = { startServer };