const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { recordAudit } = require('./auditService');

const MAX_PAGE_SIZE = 100;
const STATUSES = ['unread', 'read'];
const PRIORITIES = ['low', 'normal', 'high'];

function notificationError(statusCode, errorCode, message) {
  return Object.assign(new Error(message), { statusCode, errorCode });
}

function id(value, field = 'id') {
  if (!mongoose.isValidObjectId(value)) throw notificationError(400, 'VALIDATION_ERROR', `${field} no es válido`);
  return new mongoose.Types.ObjectId(value);
}

function normalize(data = {}) {
  const title = String(data.title || '').trim();
  const message = String(data.message || '').trim();
  const type = String(data.type || 'system.info').trim();
  const module = String(data.module || 'system').trim();
  const priority = data.priority || 'normal';
  if (!title || title.length > 120 || !message || message.length > 500 || !type || type.length > 80 || !module || module.length > 80) {
    throw notificationError(400, 'VALIDATION_ERROR', 'Los datos de la notificación no son válidos');
  }
  if (!PRIORITIES.includes(priority)) throw notificationError(400, 'VALIDATION_ERROR', 'La prioridad no es válida');
  const metadata = data.metadata == null ? null : data.metadata;
  if (metadata !== null) {
    let serialized;
    try { serialized = JSON.stringify(metadata); } catch { serialized = null; }
    if (typeof metadata !== 'object' || Array.isArray(metadata) || typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > 2048) {
      throw notificationError(400, 'VALIDATION_ERROR', 'Los metadatos superan el tamaño permitido');
    }
  }
  const recordId = data.recordId == null ? null : String(data.recordId).trim();
  if (recordId && recordId.length > 120) throw notificationError(400, 'VALIDATION_ERROR', 'El registro relacionado no es válido');
  return { type, title, message, module, recordId: recordId || null, priority, metadata };
}

function serialize(notification) {
  return {
    id: String(notification._id), userId: String(notification.userId), type: notification.type,
    title: notification.title, message: notification.message, module: notification.module,
    recordId: notification.recordId || null, status: notification.status, priority: notification.priority,
    metadata: notification.metadata || null, createdAt: notification.createdAt, readAt: notification.readAt
  };
}

async function insertForUser(userId, data, { session = null, deduplicateUnread = false } = {}) {
  const values = normalize(data);
  if (deduplicateUnread) {
    let lookup = Notification.findOne({ userId, type: values.type, recordId: values.recordId, status: 'unread' });
    if (session) lookup = lookup.session(session);
    if (await lookup.select('_id').lean()) return null;
  }
  const options = session ? { session } : {};
  const [notification] = await Notification.create([{ userId, ...values, status: 'unread' }], options);
  return notification;
}

async function recipientsWithPermission(permission, session) {
  let query = User.find({ status: 'active' }).select('_id role').populate('role', 'permissions');
  if (session) query = query.session(session);
  const users = await query.lean();
  return users.filter(user => user.role?.permissions?.includes(permission)).map(user => user._id);
}

async function notifyPermission(permission, data, { session = null, deduplicateUnread = false } = {}) {
  const recipients = await recipientsWithPermission(permission, session);
  const created = [];
  for (const userId of recipients) {
    const notification = await insertForUser(userId, data, { session, deduplicateUnread });
    if (notification) created.push(notification);
  }
  return created;
}

async function createNotification(data, actorId) {
  const actor = id(actorId, 'usuario');
  const target = data?.userId ? id(data.userId, 'userId') : actor;
  const values = normalize(data);
  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      const recipient = await User.findOne({ _id: target, status: 'active' }).select('_id').session(session);
      if (!recipient) throw notificationError(404, 'USER_NOT_FOUND', 'El destinatario no existe o está inactivo');
      const [notification] = await Notification.create([{ userId: target, ...values, status: 'unread' }], { session });
      await recordAudit({ userId: actor, action: 'notification.create', module: 'notifications', recordId: notification.id, after: notification, session });
      created = notification;
    });
    return serialize(created);
  } finally { await session.endSession(); }
}

function pageOptions(query = {}) {
  const value = Number(query.page);
  const page = Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(query.limit) || 25)));
  return { page, limit, skip: (page - 1) * limit };
}

async function listNotifications(userId, query = {}) {
  const ownerId = id(userId, 'usuario');
  const { page, limit, skip } = pageOptions(query);
  const filter = { userId: ownerId };
  if (query.status) {
    if (!STATUSES.includes(query.status)) throw notificationError(400, 'VALIDATION_ERROR', 'El estado de notificación no es válido');
    filter.status = query.status;
  }
  if (query.type) filter.type = String(query.type).trim().slice(0, 80);
  if (query.module) filter.module = String(query.module).trim().slice(0, 80);
  const sort = ['createdAt', 'priority', 'title'].includes(query.sort) ? query.sort : 'createdAt';
  const direction = query.order === 'asc' ? 1 : -1;
  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ [sort]: direction, _id: direction }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter)
  ]);
  return { items: notifications.map(serialize), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function getNotification(notificationId, userId) {
  const itemId = id(notificationId);
  const ownerId = id(userId, 'usuario');
  const notification = await Notification.findOne({ _id: itemId, userId: ownerId }).lean();
  return notification ? serialize(notification) : null;
}

async function getUnreadCount(userId) {
  const ownerId = id(userId, 'usuario');
  return Notification.countDocuments({ userId: ownerId, status: 'unread' });
}

async function markAsRead(notificationId, userId) {
  const itemId = id(notificationId);
  const ownerId = id(userId, 'usuario');
  const notification = await Notification.findOneAndUpdate(
    { _id: itemId, userId: ownerId, status: 'unread' },
    { $set: { status: 'read', readAt: new Date() } }, { new: true }
  ).lean();
  return notification ? serialize(notification) : getNotification(itemId, ownerId);
}

async function markAllAsRead(userId) {
  const ownerId = id(userId, 'usuario');
  const result = await Notification.updateMany({ userId: ownerId, status: 'unread' }, { $set: { status: 'read', readAt: new Date() } });
  return { modifiedCount: result.modifiedCount };
}

module.exports = { createNotification, listNotifications, getNotification, markAsRead, markAllAsRead, getUnreadCount, notifyPermission, normalize, serialize, notificationError };
