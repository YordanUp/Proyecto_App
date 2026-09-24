const User = require('../models/User');
const Role = require('../models/Role');
const mongoose = require('mongoose');
const { hashPassword } = require('./authService');
const { recordAudit } = require('./auditService');

function serialize(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role?.name || user.role, status: user.status,
    permissions: user.role?.permissions || [], lastAccess: user.lastAccessAt, createdAt: user.createdAt, updatedAt: user.updatedAt };
}
async function listUsers(query = {}) {
  const requestedPage = Number(query.page);
  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1;
  const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 25)));
  const filter = {};
  if (['active', 'inactive'].includes(query.status)) filter.status = query.status;
  if (query.role) {
    const role = mongoose.isValidObjectId(query.role) ? await Role.findById(query.role) : await Role.findOne({ name: String(query.role).toLowerCase() });
    filter.role = role?._id || new mongoose.Types.ObjectId();
  }
  const search = String(query.search || '').trim().slice(0, 100);
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: { $regex: safe, $options: 'i' } }, { email: { $regex: safe, $options: 'i' } }];
  }
  const sortField = ['name', 'email', 'status', 'createdAt'].includes(query.sort) ? query.sort : 'createdAt';
  const direction = query.order === 'asc' ? 1 : -1;
  const [users, total] = await Promise.all([
    User.find(filter).populate('role').sort({ [sortField]: direction, _id: 1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter)
  ]);
  return { items: users.map(serialize), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
async function getUserById(id) { const user = await User.findById(id).populate('role'); return user ? serialize(user) : null; }
async function createUser(data, actorId) {
  if (!data?.name || !data?.email || typeof data.password !== 'string' || data.password.length < 12 || Buffer.byteLength(data.password, 'utf8') > 72 || !data.role) {
    const error = new Error('Nombre, email, contraseña de al menos 12 caracteres (máximo 72 bytes) y rol son requeridos'); error.statusCode = 400; error.errorCode = 'VALIDATION_ERROR'; throw error;
  }
  const role = mongoose.isValidObjectId(data.role)
    ? await Role.findById(data.role)
    : await Role.findOne({ name: String(data.role).toLowerCase() });
  if (!role) { const error = new Error('El rol indicado no existe'); error.statusCode = 400; error.errorCode = 'INVALID_ROLE'; throw error; }
  const passwordHash = await hashPassword(data.password);
  const session = await mongoose.startSession();
  let populated;
  try {
    await session.withTransaction(async () => {
      const [user] = await User.create([{ name: data.name, email: data.email, passwordHash, role: role._id, status: data.status || 'active' }], { session });
      populated = await user.populate({ path: 'role', options: { session } });
      await recordAudit({ userId: actorId, action: 'create', module: 'users', recordId: user.id, after: populated, session });
    });
  } finally { await session.endSession(); }
  return serialize(populated);
}
async function updateUser(id, data, actorId) {
  if (data.role !== undefined) { const error = new Error('Use la operación de asignación de rol'); error.statusCode = 400; error.errorCode = 'ROLE_ASSIGNMENT_REQUIRED'; throw error; }
  if (!['name', 'email', 'status'].some(key => data[key] !== undefined)) { const error = new Error('Debe enviar al menos un campo válido'); error.statusCode = 400; error.errorCode = 'VALIDATION_ERROR'; throw error; }
  const user = await User.findById(id).populate('role');
  if (!user) return null;
  const before = user.toObject();
  for (const key of ['name', 'email', 'status']) if (data[key] !== undefined) user[key] = data[key];
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await user.save({ session }); await user.populate({ path: 'role', options: { session } });
      await recordAudit({ userId: actorId, action: 'update', module: 'users', recordId: id, before, after: user, session });
    });
  } finally { await session.endSession(); }
  return serialize(user);
}
async function setUserStatus(id, status, actorId) {
  if (!['active', 'inactive'].includes(status)) { const error = new Error('Estado inválido'); error.statusCode = 400; error.errorCode = 'VALIDATION_ERROR'; throw error; }
  return updateUser(id, { status }, actorId);
}
async function changeUserRole(id, roleId, actorId) {
  const role = mongoose.isValidObjectId(roleId)
    ? await Role.findById(roleId)
    : await Role.findOne({ name: String(roleId || '').toLowerCase() });
  if (!role) { const error = new Error('El rol indicado no existe'); error.statusCode = 400; error.errorCode = 'INVALID_ROLE'; throw error; }
  const session = await mongoose.startSession();
  let updated = null;
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(id).session(session);
      if (!user) return;
      const before = user.toObject();
      user.role = role._id;
      await user.save({ session });
      updated = await user.populate({ path: 'role', options: { session } });
      await recordAudit({ userId: actorId, action: 'role.update', module: 'users', recordId: id, before, after: updated, session });
    });
  } finally { await session.endSession(); }
  return updated ? serialize(updated) : null;
}

module.exports = { listUsers, getUserById, createUser, updateUser, toggleUserStatus: setUserStatus, changeUserRole };
