const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  folio: { type: String, required: true, immutable: true, trim: true },
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true, immutable: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  originalAmount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, required: true, min: 0, default: 0 },
  balance: { type: Number, required: true, min: 0 },
  status: { type: String, required: true, enum: ['pending', 'partial', 'paid', 'cancelled'], default: 'pending', index: true },
  dueDate: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  paidAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

schema.index({ folio: 1 }, { unique: true });
schema.index({ sale: 1 }, { unique: true });
schema.index({ status: 1, createdAt: -1 });
schema.index({ customer: 1, createdAt: -1 });
schema.pre('validate', function validateReceivable(next) {
  const expected = Math.round((this.originalAmount - this.paidAmount) * 100) / 100;
  if (this.paidAmount > this.originalAmount || Math.abs(this.balance - expected) > 0.001) this.invalidate('balance', 'El saldo debe coincidir con el monto original menos lo pagado');
  if (this.status !== 'cancelled') {
    const expectedStatus = this.balance === 0 ? 'paid' : this.paidAmount > 0 ? 'partial' : 'pending';
    if (this.status !== expectedStatus) this.invalidate('status', 'El estado no coincide con los montos de la cuenta');
  }
  next();
});

module.exports = mongoose.models.AccountsReceivable || mongoose.model('AccountsReceivable', schema);
