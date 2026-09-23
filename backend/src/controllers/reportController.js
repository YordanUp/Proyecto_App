const { listReports, createReport, listNotifications, createNotification, listAuditLogs, createAuditLog } = require('../services/reportService');
const { successResponse, errorResponse } = require('../utils/response');

function getReports(req, res) {
  return successResponse(res, 200, 'Reportes consultados', listReports());
}

function createReportController(req, res) {
  try {
    const report = createReport(req.body);
    return successResponse(res, 201, 'Reporte generado correctamente', report);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'REPORT_CREATE_ERROR');
  }
}

function getNotifications(req, res) {
  return successResponse(res, 200, 'Notificaciones consultadas', listNotifications());
}

function createNotificationController(req, res) {
  try {
    const notification = createNotification(req.body);
    return successResponse(res, 201, 'Notificación creada correctamente', notification);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'NOTIFICATION_CREATE_ERROR');
  }
}

function getAuditLogs(req, res) {
  return successResponse(res, 200, 'Auditoría consultada', listAuditLogs());
}

function createAuditLogController(req, res) {
  try {
    const log = createAuditLog(req.body);
    return successResponse(res, 201, 'Registro de auditoría creado correctamente', log);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'AUDIT_CREATE_ERROR');
  }
}

module.exports = {
  getReports,
  createReportController,
  getNotifications,
  createNotificationController,
  getAuditLogs,
  createAuditLogController
};
