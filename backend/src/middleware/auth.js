const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');
const { recordAudit } = require('../services/auditService');

async function authenticateToken(req, res, next) {
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
    const user = await User.findById(decoded.sub).populate('role');
    if (!user || user.status !== 'active' || !user.role) {
      return res.status(401).json({ success: false, message: 'La sesión ya no es válida', error: 'INVALID_SESSION' });
    }
    req.user = { id: user.id, email: user.email, role: user.role.name, permissions: user.role.permissions };
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({
      success: false,
      message: 'Token inválido o expirado',
      error: 'INVALID_TOKEN'
    });
    return next(error);
  }
}

function authorize(permissions = []) {
  return async (req, res, next) => {
    const userPermissions = req.user?.permissions || [];
    const hasPermission = permissions.every((permission) => userPermissions.includes(permission));

    if (!hasPermission) {
      try {
        await recordAudit({ userId: req.user?.id, action: 'permission.denied', module: 'authorization', recordId: `${req.method} ${req.baseUrl}${req.path}`, after: { requiredPermissions: permissions } });
      } catch (error) { console.error('No se pudo registrar el rechazo de autorización:', error.message); }
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
