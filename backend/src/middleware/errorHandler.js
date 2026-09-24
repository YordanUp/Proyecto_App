const notFoundHandler = (req, res, next) => {
  const error = new Error(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  error.errorCode = 'ROUTE_NOT_FOUND';
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'Error interno del servidor';

  if (err.name === 'ValidationError') { statusCode = 400; errorCode = 'VALIDATION_ERROR'; message = 'Los datos enviados no son válidos'; }
  else if (err.name === 'CastError') { statusCode = 400; errorCode = 'INVALID_IDENTIFIER'; message = 'Identificador inválido'; }
  else if (err.code === 11000) { statusCode = 409; errorCode = 'DUPLICATE_RECORD'; message = 'Ya existe un registro con esos datos'; }
  else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') { statusCode = 401; errorCode = 'INVALID_TOKEN'; message = 'Token inválido o expirado'; }
  else if (err.type === 'entity.parse.failed') { statusCode = 400; errorCode = 'INVALID_JSON'; message = 'El cuerpo JSON no es válido'; }
  else if (statusCode >= 500) { message = 'Error interno del servidor'; }
  const response = {
    success: false,
    message,
    error: errorCode
  };
  res.status(statusCode).json(response);
};

module.exports = {
  notFoundHandler,
  errorHandler
};
