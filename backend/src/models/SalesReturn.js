const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  saleLineIndex: { type: Number, required: true, min: 0 },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  productNameSnapshot: { type: String, required: true, trim: true, maxlength: 160 },
  skuSnapshot: { type: String, trim: true, maxlength: 64, default: '' },
  quantity: { type: Number, required: true, min: 0.000001 },
  unitPrice: { type: Number, required: true, min: 0 },
  taxRate: { type: Number, required: true, min: 0, max: 100 },
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 }
}, { _id: false });

const schema = new mongoose.Schema({
  folio: { type: String, required: true, immutable: true, trim: true },
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true, immutable: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, immutable: true, index: true },
  items: { type: [itemSchema], required: true, validate: items => Array.isArray(items) && items.length > 0 },
  reason: { type: String, required: true, trim: true, maxlength: 300 },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, required: true, enum: ['processed'], default: 'processed', immutable: true },
  subtotal: { type: Number, required: true, min: 0 },
  taxes: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  processedAt: { type: Date, required: true, default: Date.now, immutable: true }
}, { timestamps: true, versionKey: false });

schema.index({ folio: 1 }, { unique: true });
schema.index({ sale: 1, status: 1 });
schema.index({ sale: 1, createdAt: -1 });
schema.index({ customer: 1, createdAt: -1 });
schema.index({ status: 1, processedAt: -1 });

module.exports = mongoose.models.SalesReturn || mongoose.model('SalesReturn', schema);
