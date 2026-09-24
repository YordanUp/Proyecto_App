const { listReports, createReport, listNotifications, createNotification } = require('../services/reportService');
const auditService = require('../services/auditService');
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

async function getAuditLogs(req, res, next) {
  try {
    const result = await auditService.listAuditLogs(req.query);
    return res.status(200).json({ success: true, message: 'Auditoría consultada', data: result.items, pagination: result.pagination });
  } catch (error) { return next(error); }
}

module.exports = {
  getReports,
  createReportController,
  getNotifications,
  createNotificationController,
  getAuditLogs,
};
