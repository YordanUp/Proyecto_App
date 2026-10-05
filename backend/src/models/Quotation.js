const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  productNameSnapshot: { type: String, required: true, trim: true, maxlength: 160 },
  skuSnapshot: { type: String, trim: true, maxlength: 64, default: '' },
  quantity: { type: Number, required: true, min: 0.000001 },
  unitPrice: { type: Number, required: true, min: 0 },
  taxRate: { type: Number, required: true, min: 0, max: 100, default: 0 },
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 }
}, { _id: false });

const quotationSchema = new mongoose.Schema({
  folio: { type: String, required: true, trim: true, immutable: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  items: { type: [quotationItemSchema], required: true, validate: { validator: items => Array.isArray(items) && items.length > 0, message: 'La cotización debe contener al menos un producto' } },
  subtotal: { type: Number, required: true, min: 0 },
  taxes: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  status: { type: String, required: true, enum: ['draft', 'sent', 'accepted', 'rejected', 'converted', 'cancelled'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sentAt: { type: Date, default: null },
  acceptedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },
  convertedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null }
}, { timestamps: true, versionKey: false });

quotationSchema.index({ folio: 1 }, { unique: true });
quotationSchema.index({ status: 1, createdAt: -1 });
quotationSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.models.Quotation || mongoose.model('Quotation', quotationSchema);
