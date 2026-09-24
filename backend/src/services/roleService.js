const mongoose = require('mongoose');
const Role = require('../models/Role');
const { PERMISSIONS } = require('./permissions');
const { recordAudit } = require('./auditService');
const serialize = role => ({ id: role.id, name: role.name, description: role.description, permissions: role.permissions, isSystem: role.isSystem, createdAt: role.createdAt, updatedAt: role.updatedAt });
const byId = id => mongoose.isValidObjectId(id) ? Role.findById(id) : Role.findOne({ name: String(id).toLowerCase() });
async function listRoles() { return (await Role.find().sort({ name: 1 })).map(serialize); }
async function getRoleById(id) { const role = await byId(id); return role ? serialize(role) : null; }
async function createRole(data, actorId) {
  if (!data?.name || !Array.isArray(data.permissions)) { const e = new Error('Nombre y lista de permisos son requeridos'); e.statusCode = 400; e.errorCode = 'VALIDATION_ERROR'; throw e; }
  const invalid = data.permissions.filter(permission => !PERMISSIONS.includes(permission));
  if (invalid.length) { const e = new Error(`Permisos desconocidos: ${invalid.join(', ')}`); e.statusCode = 400; e.errorCode = 'INVALID_PERMISSION'; throw e; }
  const session = await mongoose.startSession();
  let role;
  try {
    await session.withTransaction(async () => {
      [role] = await Role.create([{ name: data.name, description: data.description, permissions: [...new Set(data.permissions)] }], { session });
      await recordAudit({ userId: actorId, action: 'create', module: 'roles', recordId: role.id, after: role, session });
    });
  } finally { await session.endSession(); }
  return serialize(role);
}
async function updateRole(id, data, actorId) {
  if (!['name', 'description', 'permissions'].some(key => data?.[key] !== undefined)) { const e = new Error('Debe enviar al menos un campo válido'); e.statusCode = 400; e.errorCode = 'VALIDATION_ERROR'; throw e; }
  const session = await mongoose.startSession();
  let updated = null;
  try {
    await session.withTransaction(async () => {
      const role = await byId(id).session(session);
      if (!role) return;
      if (role.isSystem) { const e = new Error('Los roles del sistema no se pueden modificar'); e.statusCode = 403; e.errorCode = 'SYSTEM_ROLE_PROTECTED'; throw e; }
      const before = role.toObject();
      if (data.name !== undefined) role.name = data.name;
      if (data.description !== undefined) role.description = data.description;
      if (data.permissions !== undefined) {
        if (!Array.isArray(data.permissions)) { const e = new Error('Los permisos deben ser una lista'); e.statusCode = 400; e.errorCode = 'VALIDATION_ERROR'; throw e; }
        const invalid = data.permissions.filter(permission => !PERMISSIONS.includes(permission));
        if (invalid.length) { const e = new Error(`Permisos desconocidos: ${invalid.join(', ')}`); e.statusCode = 400; e.errorCode = 'INVALID_PERMISSION'; throw e; }
        role.permissions = [...new Set(data.permissions)];
      }
      await role.save({ session }); updated = role;
      await recordAudit({ userId: actorId, action: 'permissions.update', module: 'roles', recordId: role.id, before, after: role, session });
    });
  } finally { await session.endSession(); }
  return updated ? serialize(updated) : null;
}
module.exports = { listRoles, getRoleById, createRole, updateRole };
