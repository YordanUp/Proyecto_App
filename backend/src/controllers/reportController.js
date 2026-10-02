const { listNotifications, createNotification } = require('../services/legacyNotificationService');
const reportService = require('../services/reportService');
const auditService = require('../services/auditService');
const { successResponse, errorResponse } = require('../utils/response');

async function getDataReport(req, res, next) {
  try {
    const result = await reportService.getReport(req.params.type, req.query);
    return res.status(200).json({ success: true, message: 'Reporte consultado correctamente', data: result.items, pagination: result.pagination, totals: result.totals });
  } catch (error) { return next(error); }
}

async function exportDataReport(req, res, next) {
  try {
    const result = await reportService.exportReport(req.params.type, req.query, req.user.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.csv);
  } catch (error) { return next(error); }
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

module.exports = { getDataReport, exportDataReport, getNotifications, createNotificationController, getAuditLogs };
