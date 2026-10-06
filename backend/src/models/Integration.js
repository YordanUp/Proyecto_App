const mongoose = require('mongoose');
const { validateIntegrationConfig } = require('../utils/integrationConfig');

const integrationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  type: { type: String, required: true, enum: ['payments', 'messaging', 'crm', 'accounting', 'storage', 'other'] },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  owner: { type: String, trim: true, maxlength: 120, default: '' },
  enabled: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'connected', 'disconnected', 'error'], default: 'pending' },
  lastSyncAt: { type: Date, default: null },
  lastError: { type: String, trim: true, maxlength: 1000, default: null },
  config: { type: mongoose.Schema.Types.Mixed, default: () => ({}), validate: { validator: value => { try { validateIntegrationConfig(value); return true; } catch { return false; } }, message: 'La configuración debe ser segura y válida' } },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true, versionKey: false, strict: 'throw' });

integrationSchema.index({ slug: 1 }, { unique: true });
integrationSchema.index({ status: 1 });
integrationSchema.index({ type: 1 });
integrationSchema.index({ enabled: 1 });
integrationSchema.index({ updatedAt: -1 });

module.exports = mongoose.models.Integration || mongoose.model('Integration', integrationSchema);
