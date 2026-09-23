function successResponse(res, statusCode = 200, message, data = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function errorResponse(res, statusCode = 400, message, errorCode = 'BAD_REQUEST', details = null) {
  const payload = {
    success: false,
    message,
    error: errorCode
  };

  if (details) payload.details = details;

  return res.status(statusCode).json(payload);
}

module.exports = {
  successResponse,
  errorResponse
};
