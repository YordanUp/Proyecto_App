const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config/config');
const { mongoose } = require('./config/database');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

app.use(helmet());
const allowedOrigins = config.corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true
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

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
