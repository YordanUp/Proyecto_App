const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, enum: ['company_name', 'currency', 'timezone', 'date_format'], trim: true },
  label: { type: String, required: true, trim: true, maxlength: 120 },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  type: { type: String, required: true, enum: ['text', 'select', 'boolean'] },
  category: { type: String, required: true, enum: ['general'], default: 'general' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true, versionKey: false });

settingSchema.index({ key: 1 }, { unique: true });
settingSchema.index({ category: 1, key: 1 });

module.exports = mongoose.models.SystemSetting || mongoose.model('SystemSetting', settingSchema);
