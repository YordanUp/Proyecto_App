const jwt = require('jsonwebtoken');
const config = require('../config/config');

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token de autenticación requerido',
      error: 'UNAUTHORIZED'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido o expirado',
      error: 'INVALID_TOKEN'
    });
  }
}

function authorize(permissions = []) {
  return (req, res, next) => {
    const userPermissions = req.user?.permissions || [];
    const hasPermission = permissions.every((permission) => userPermissions.includes(permission));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ejecutar esta acción',
        error: 'FORBIDDEN'
      });
    }

    next();
  };
}

module.exports = { authenticateToken, authorize };
