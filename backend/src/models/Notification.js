const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true, trim: true, maxlength: 80 },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  module: { type: String, required: true, trim: true, maxlength: 80 },
  recordId: { type: String, default: null, trim: true, maxlength: 120 },
  status: { type: String, enum: ['unread', 'read'], default: 'unread', required: true },
  priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal', required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  readAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

notificationSchema.index({ userId: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, recordId: 1, status: 1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
