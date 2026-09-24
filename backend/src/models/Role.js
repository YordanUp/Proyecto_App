const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  permissions: { type: [String], default: [], validate: values => new Set(values).size === values.length },
  isSystem: { type: Boolean, default: false }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema);
