const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['RECEIVABLE_PAYMENT', 'PAYABLE_PAYMENT'], index: true },
  direction: { type: String, required: true, enum: ['IN', 'OUT'], index: true },
  amount: { type: Number, required: true, min: 0.01 },
  referenceType: { type: String, required: true, enum: ['sale', 'purchase'], index: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'referenceModel' },
  referenceModel: { type: String, required: true, enum: ['Sale', 'Purchase'] },
  accountId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'accountModel' },
  accountModel: { type: String, required: true, enum: ['AccountsReceivable', 'AccountsPayable'] },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  paymentMethod: { type: String, enum: ['cash', 'transfer', 'card', 'check', 'other'], default: 'other' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

schema.index({ createdAt: -1, _id: -1 });
schema.index({ accountId: 1, createdAt: -1 });
schema.index({ referenceType: 1, referenceId: 1, createdAt: -1 });

module.exports = mongoose.models.FinancialMovement || mongoose.model('FinancialMovement', schema);
