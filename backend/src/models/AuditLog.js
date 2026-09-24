const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  action: { type: String, required: true, trim: true, maxlength: 100 },
  module: { type: String, required: true, trim: true, maxlength: 80, index: true },
  recordId: { type: String, default: null, index: true },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  occurredAt: { type: Date, default: Date.now, index: true },
  requestId: { type: String, default: null }
}, { versionKey: false, strict: true });

auditLogSchema.index({ module: 1, occurredAt: -1 });
module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
