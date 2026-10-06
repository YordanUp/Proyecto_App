const mongoose = require('mongoose');
const Integration = require('../models/Integration');
const { recordAudit } = require('./auditService');
const { integrationError, validateIntegrationConfig } = require('../utils/integrationConfig');

const TYPES = ['payments', 'messaging', 'crm', 'accounting', 'storage', 'other'];
const CREATE_FIELDS = new Set(['name', 'slug', 'type', 'description', 'owner', 'config']);
const UPDATE_FIELDS = new Set(['name', 'description', 'type', 'owner', 'config']);

function validateFields(data, allowed) {
  const unknown = Object.keys(data || {}).filter(key => !allowed.has(key));
  if (unknown.length) throw integrationError(400, 'VALIDATION_ERROR', `Campos no permitidos: ${unknown.join(', ')}`);
}
function slugify(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-+$/g, '');
}
function validatePayload(data, { create = false } = {}) {
  data = data || {};
  validateFields(data, create ? CREATE_FIELDS : UPDATE_FIELDS);
  if (!create && !Object.keys(data).length) throw integrationError(400, 'VALIDATION_ERROR', 'Incluye al menos un campo permitido para actualizar');
  const values = {};
  if (create || Object.hasOwn(data, 'name')) {
    if (typeof data.name !== 'string') throw integrationError(400, 'VALIDATION_ERROR', 'El nombre debe ser texto');
    const name = data.name.trim();
    if (!name || name.length > 120) throw integrationError(400, 'VALIDATION_ERROR', 'El nombre debe tener entre 1 y 120 caracteres');
    values.name = name;
  }
  if (create || Object.hasOwn(data, 'type')) {
    if (!TYPES.includes(data.type)) throw integrationError(400, 'VALIDATION_ERROR', 'El tipo de integración no es válido');
    values.type = data.type;
  }
  for (const key of ['description', 'owner']) {
    if (Object.hasOwn(data || {}, key)) {
      if (typeof data[key] !== 'string') throw integrationError(400, 'VALIDATION_ERROR', `${key} debe ser texto`);
      const value = data[key].trim();
      const max = key === 'description' ? 500 : 120;
      if (value.length > max) throw integrationError(400, 'VALIDATION_ERROR', `${key} supera el máximo permitido`);
      values[key] = value;
    }
  }
  if (create) {
    if (data.slug != null && typeof data.slug !== 'string') throw integrationError(400, 'VALIDATION_ERROR', 'El slug debe ser texto');
    const slug = slugify(data.slug || values.name);
    if (!slug) throw integrationError(400, 'VALIDATION_ERROR', 'No se pudo generar un slug válido');
    values.slug = slug;
  }
  if (Object.hasOwn(data || {}, 'config')) values.config = validateIntegrationConfig(data.config);
  else if (create) values.config = {};
  return values;
}
function serialize(doc) {
  const value = doc?.toObject ? doc.toObject() : doc;
  return {
    id: String(value._id || value.id), name: value.name, slug: value.slug, type: value.type,
    description: value.description || '', owner: value.owner || '', enabled: Boolean(value.enabled), status: value.status,
    lastSyncAt: value.lastSyncAt || null, lastError: value.lastError || null, config: value.config || {},
    createdBy: value.createdBy ? String(value.createdBy._id || value.createdBy) : null,
    updatedBy: value.updatedBy ? String(value.updatedBy._id || value.updatedBy) : null,
    createdAt: value.createdAt, updatedAt: value.updatedAt
  };
}
function objectId(id) {
  if (!mongoose.isValidObjectId(id)) throw integrationError(400, 'INVALID_IDENTIFIER', 'Identificador de integración inválido');
  return new mongoose.Types.ObjectId(id);
}
function pagination(query = {}) {
  const parsedPage = Math.floor(Number(query.page));
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 1000000) : 1;
  const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 25)));
  return { page, limit, skip: (page - 1) * limit };
}
function escapeRegex(value) { return String(value || '').trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function buildFilter(query = {}) {
  const filter = {};
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: pattern }, { slug: pattern }, { description: pattern }, { owner: pattern }];
  }
  if (query.status) {
    if (!['pending', 'connected', 'disconnected', 'error'].includes(query.status)) throw integrationError(400, 'VALIDATION_ERROR', 'El estado de integración no es válido');
    filter.status = query.status;
  }
  if (query.type) {
    if (!TYPES.includes(query.type)) throw integrationError(400, 'VALIDATION_ERROR', 'El tipo de integración no es válido');
    filter.type = query.type;
  }
  if (query.enabled !== undefined && query.enabled !== '') {
    if (!['true', 'false'].includes(String(query.enabled))) throw integrationError(400, 'VALIDATION_ERROR', 'enabled debe ser true o false');
    filter.enabled = String(query.enabled) === 'true';
  }
  return filter;
}
async function listIntegrations(query = {}) {
  const filter = buildFilter(query); const page = pagination(query);
  const [items, total] = await Promise.all([
    Integration.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(page.skip).limit(page.limit).lean(),
    Integration.countDocuments(filter)
  ]);
  return { items: items.map(serialize), pagination: { page: page.page, limit: page.limit, total, pages: Math.ceil(total / page.limit) } };
}
async function getIntegrationById(id) {
  const item = await Integration.findById(objectId(id)).lean();
  if (!item) throw integrationError(404, 'INTEGRATION_NOT_FOUND', 'La integración no existe');
  return serialize(item);
}
async function mutate({ id = null, userId, action, values = null }) {
  const actor = objectId(userId);
  const session = await mongoose.startSession(); let result;
  try {
    await session.withTransaction(async () => {
      let doc; let before = null;
      if (action === 'integrations.create') {
        doc = new Integration({ ...values, enabled: false, status: 'pending', lastSyncAt: null, lastError: null, createdBy: actor, updatedBy: actor });
        await doc.save({ session });
      } else {
        doc = await Integration.findById(objectId(id)).session(session);
        if (!doc) throw integrationError(404, 'INTEGRATION_NOT_FOUND', 'La integración no existe');
        before = serialize(doc);
        if (action === 'integrations.update') Object.assign(doc, values);
        if (action === 'integrations.enable') { doc.enabled = true; if (doc.status === 'disconnected') doc.status = 'pending'; }
        if (action === 'integrations.disable') { doc.enabled = false; doc.status = 'disconnected'; }
        doc.updatedBy = actor;
        await doc.save({ session });
      }
      result = serialize(doc);
      await recordAudit({ userId: actor, action, module: 'integrations', recordId: result.id, before, after: result, session });
    });
    return result;
  } finally { await session.endSession(); }
}
function createIntegration(data, userId) { return mutate({ userId, action: 'integrations.create', values: validatePayload(data, { create: true }) }); }
function updateIntegration(id, data, userId) { return mutate({ id, userId, action: 'integrations.update', values: validatePayload(data) }); }
function enableIntegration(id, userId) { return mutate({ id, userId, action: 'integrations.enable' }); }
function disableIntegration(id, userId) { return mutate({ id, userId, action: 'integrations.disable' }); }

module.exports = { TYPES, listIntegrations, getIntegrationById, createIntegration, updateIntegration, enableIntegration, disableIntegration, validatePayload, slugify, buildFilter, serialize, integrationError };
