const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { getDatabaseStatus } = require('./config/database');
const routes = require('./routes');
const config = require('./config/config');

const app = express();

app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas peticiones. Intente más tarde.',
    error: 'RATE_LIMIT_EXCEEDED'
  }
});
app.use(limiter);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ERP API funcionando correctamente',
    data: {
      name: 'ERP Modular',
      version: '1.0.0',
      mode: config.nodeEnv
    }
  });
});

app.get('/api/health', (req, res) => {
  const database = getDatabaseStatus();

  res.status(database.state === 'connected' ? 200 : 503).json({
    success: database.state === 'connected',
    message: database.state === 'connected'
      ? 'ERP disponible'
      : 'ERP no está listo',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database
    }
  });
});

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;