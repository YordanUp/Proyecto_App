const { reportSeed, notificationSeed, auditSeed } = require('../data/reports');

const reports = reportSeed;
const notifications = notificationSeed;
const audits = auditSeed;

function listReports() {
  return reports;
}

function createReport(data) {
  if (!data.type || !data.title) {
    throw new Error('Tipo y título son requeridos');
  }

  const report = {
    id: `rep${Date.now()}`,
    type: data.type,
    title: data.title,
    generatedAt: new Date().toISOString(),
    status: data.status || 'ready'
  };

  reports.push(report);
  return report;
}

function listNotifications() {
  return notifications;
}

function createNotification(data) {
  if (!data.title || !data.message) {
    throw new Error('Título y mensaje son requeridos');
  }

  const notification = {
    id: `nt${Date.now()}`,
    title: data.title,
    message: data.message,
    type: data.type || 'info',
    read: false,
    createdAt: new Date().toISOString()
  };

  notifications.push(notification);
  return notification;
}

function listAuditLogs() {
  return audits;
}

function createAuditLog(data) {
  if (!data.action || !data.entity) {
    throw new Error('Acción y entidad son requeridos');
  }

  const audit = {
    id: `aud${Date.now()}`,
    action: data.action,
    userId: data.userId || 'system',
    entity: data.entity,
    createdAt: new Date().toISOString()
  };

  audits.push(audit);
  return audit;
}

module.exports = {
  listReports,
  createReport,
  listNotifications,
  createNotification,
  listAuditLogs,
  createAuditLog
};
