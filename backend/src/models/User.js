const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true, select: false },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true, index: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  lastAccessAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

userSchema.index({ email: 1 }, { unique: true });
userSchema.set('toJSON', { transform: (_doc, ret) => { delete ret.passwordHash; return ret; } });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
