const mongoose = require('mongoose');
const SystemSetting = require('../models/SystemSetting');
const { recordAudit } = require('./auditService');

const DEFAULT_SETTINGS = [
  { key: 'company_name', label: 'Nombre de la empresa', value: 'ERP Modular', type: 'text', category: 'general' },
  { key: 'currency', label: 'Moneda', value: 'USD', type: 'select', category: 'general' },
  { key: 'timezone', label: 'Zona horaria', value: 'America/Mexico_City', type: 'select', category: 'general' },
  { key: 'date_format', label: 'Formato de fecha', value: 'DD/MM/YYYY', type: 'select', category: 'general' }
];
const ALLOWED_VALUES = {
  currency: ['MXN', 'USD', 'EUR'],
  timezone: ['America/Mexico_City', 'UTC'],
  date_format: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']
};

function settingError(statusCode, errorCode, message) {
  return Object.assign(new Error(message), { statusCode, errorCode });
}

function objectId(value) {
  if (!mongoose.isValidObjectId(value)) throw settingError(400, 'VALIDATION_ERROR', 'El usuario no es válido');
  return new mongoose.Types.ObjectId(value);
}

function validateValue(key, rawValue) {
  if (!DEFAULT_SETTINGS.some(setting => setting.key === key)) {
    throw settingError(404, 'SETTING_NOT_FOUND', 'La configuración solicitada no existe');
  }
  if (key === 'company_name') {
    if (typeof rawValue !== 'string' || !rawValue.trim() || rawValue.trim().length > 120) {
      throw settingError(400, 'VALIDATION_ERROR', 'El nombre de la empresa debe tener entre 1 y 120 caracteres');
    }
    return rawValue.trim();
  }
  if (typeof rawValue !== 'string' || !ALLOWED_VALUES[key].includes(rawValue)) {
    throw settingError(400, 'VALIDATION_ERROR', `El valor de ${key} no está permitido`);
  }
  return rawValue;
}

function serialize(setting) {
  return {
    id: String(setting._id), key: setting.key, label: setting.label, value: setting.value,
    type: setting.type, category: setting.category, updatedAt: setting.updatedAt,
    updatedBy: setting.updatedBy ? String(setting.updatedBy) : null
  };
}

async function listSettings() {
  const settings = await SystemSetting.find({}).sort({ category: 1, key: 1 }).lean();
  return settings.map(serialize);
}

async function getSetting(key) {
  const setting = await SystemSetting.findOne({ key }).lean();
  return setting ? serialize(setting) : null;
}

async function updateSetting(key, rawValue, userId) {
  const value = validateValue(key, rawValue);
  const actorId = objectId(userId);
  const session = await mongoose.startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      const before = await SystemSetting.findOne({ key }).session(session);
      if (!before) throw settingError(404, 'SETTING_NOT_FOUND', 'La configuración no existe; sincroniza los valores base antes de editarla');
      const previousValue = before.value;
      before.value = value;
      before.updatedBy = actorId;
      await before.save({ session });
      await recordAudit({ userId: actorId, action: 'settings.update', module: 'settings', recordId: key, before: { key, value: previousValue }, after: { key, value }, session });
      updated = serialize(before);
    });
    return updated;
  } finally { await session.endSession(); }
}

async function bootstrapSettings({ mode, session = null } = {}) {
  if (!['dry-run', 'apply'].includes(mode)) throw settingError(400, 'INVALID_MODE', 'Indica --dry-run o --apply');
  let existingQuery = SystemSetting.find({ key: { $in: DEFAULT_SETTINGS.map(item => item.key) } }).select('key');
  if (session) existingQuery = existingQuery.session(session);
  const existing = await existingQuery.lean();
  const existingKeys = new Set(existing.map(item => item.key));
  const missing = DEFAULT_SETTINGS.filter(item => !existingKeys.has(item.key));
  if (mode === 'dry-run') return { mode, missing: missing.map(item => item.key), created: 0, preserved: existingKeys.size };

  let created = 0;
  for (const setting of missing) {
    try {
      const options = { upsert: true, runValidators: true, ...(session ? { session } : {}) };
      const result = await SystemSetting.updateOne({ key: setting.key }, { $setOnInsert: setting }, options);
      if (result.upsertedCount) created += 1;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  return { mode, missing: [], created, preserved: DEFAULT_SETTINGS.length - created };
}

module.exports = { DEFAULT_SETTINGS, ALLOWED_VALUES, listSettings, getSetting, updateSetting, bootstrapSettings, validateValue, settingError, serialize };
