const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productNameSnapshot: { type: String, required: true, trim: true, maxlength: 160 },
  skuSnapshot: { type: String, trim: true, maxlength: 64, default: '' },
  quantity: { type: Number, required: true, min: 0.000001 },
  unitCost: { type: Number, required: true, min: 0 },
  taxRate: { type: Number, required: true, min: 0, max: 100, default: 0 },
  tax: { type: Number, required: true, min: 0, default: 0 },
  subtotal: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true }
}, { _id: false });

const purchaseSchema = new mongoose.Schema({
  folio: { type: String, required: true, trim: true, immutable: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  items: { type: [purchaseItemSchema], required: true, validate: { validator: items => Array.isArray(items) && items.length > 0, message: 'La compra debe contener al menos un producto' } },
  subtotal: { type: Number, required: true, min: 0 },
  taxes: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  status: { type: String, required: true, enum: ['draft', 'ordered', 'received', 'cancelled'], default: 'draft', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receivedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

purchaseSchema.index({ folio: 1 }, { unique: true });
purchaseSchema.index({ status: 1, createdAt: -1 });
purchaseSchema.index({ supplier: 1, createdAt: -1 });

module.exports = mongoose.models.Purchase || mongoose.model('Purchase', purchaseSchema);
