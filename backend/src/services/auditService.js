const AuditLog = require('../models/AuditLog');

function snapshot(value) {
  if (!value) return null;
  const plain = typeof value.toObject === 'function' ? value.toObject() : value;
  delete plain.passwordHash;
  return plain;
}

function recordAudit({ userId, action, module, recordId, before = null, after = null, requestId = null, session = null }) {
  const entry = { userId: userId || null, action, module, recordId: recordId ? String(recordId) : null, before: snapshot(before), after: snapshot(after), requestId };
  return session ? AuditLog.create([entry], { session }).then(([created]) => created) : AuditLog.create(entry);
}

async function listAuditLogs(query = {}) {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 25)));
  const filter = {};
  if (query.module) filter.module = String(query.module).slice(0, 80);
  const [items, total] = await Promise.all([
    AuditLog.find(filter).populate('userId', 'name email').sort({ occurredAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter)
  ]);
  return { items: items.map(entry => ({ ...entry, id: String(entry._id) })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

module.exports = { recordAudit, listAuditLogs };
