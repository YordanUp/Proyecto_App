const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true, select: false },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true, index: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  // Existing documents without this field remain usable; new accounts opt in to verification explicitly.
  emailVerified: { type: Boolean, default: true, index: true },
  emailVerifiedAt: { type: Date, default: null },
  emailVerificationTokenHash: { type: String, default: null, select: false },
  emailVerificationExpiresAt: { type: Date, default: null, select: false },
  welcomeEmailAttemptedAt: { type: Date, default: null, select: false },
  welcomeEmailSentAt: { type: Date, default: null, select: false },
  lastAccessAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ emailVerificationTokenHash: 1 }, { partialFilterExpression: { emailVerificationTokenHash: { $type: 'string' } } });
userSchema.set('toJSON', { transform: (_doc, ret) => {
  for (const field of ['passwordHash', 'emailVerificationTokenHash', 'emailVerificationExpiresAt', 'welcomeEmailAttemptedAt', 'welcomeEmailSentAt']) delete ret[field];
  return ret;
} });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
