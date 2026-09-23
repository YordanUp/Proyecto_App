require('dotenv').config();

const app = require('./src/app');
const config = require('./src/config/config');

const server = app.listen(config.port, () => {
  console.log(`ERP backend running on port ${config.port}`);
});

module.exports = server;
