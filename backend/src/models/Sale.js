const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  productNameSnapshot: { type: String, required: true, trim: true, maxlength: 160 },
  skuSnapshot: { type: String, trim: true, maxlength: 64, default: '' },
  quantity: { type: Number, required: true, min: 0.000001 },
  unitPrice: { type: Number, required: true, min: 0 },
  taxRate: { type: Number, required: true, min: 0, max: 100, default: 0 },
  tax: { type: Number, required: true, min: 0, default: 0 },
  subtotal: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  folio: { type: String, required: true, trim: true, immutable: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  items: { type: [saleItemSchema], required: true, validate: { validator: items => Array.isArray(items) && items.length > 0, message: 'La venta debe contener al menos un producto' } },
  subtotal: { type: Number, required: true, min: 0 },
  taxes: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  status: { type: String, required: true, enum: ['draft', 'confirmed', 'cancelled'], default: 'draft', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  confirmedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

saleSchema.index({ status: 1, createdAt: -1 });
saleSchema.index({ customer: 1, createdAt: -1 });
saleSchema.index({ folio: 1 }, { unique: true });

module.exports = mongoose.models.Sale || mongoose.model('Sale', saleSchema);
