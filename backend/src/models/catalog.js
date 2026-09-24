const mongoose = require('mongoose');

const timestamps = { timestamps: true, versionKey: false };
const status = { type: String, enum: ['active', 'inactive'], default: 'active', index: true };

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  status
}, timestamps);
categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

const productSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  purchasePrice: { type: Number, required: true, min: 0 },
  salePrice: { type: Number, required: true, min: 0 },
  minStock: { type: Number, default: 0, min: 0 },
  status
}, timestamps);
productSchema.index({ code: 1 }, { unique: true });
productSchema.index({ name: 1 });
productSchema.pre('validate', function validatePrice(next) {
  if (this.salePrice < this.purchasePrice) this.invalidate('salePrice', 'El precio de venta no puede ser menor al precio de compra');
  next();
});

function partySchema() {
  return new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 160 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, validate: value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    status
  }, timestamps);
}
const clientSchema = partySchema();
const supplierSchema = partySchema();
clientSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
supplierSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });

const warehouseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  address: { type: String, trim: true, maxlength: 300, default: '' },
  status
}, timestamps);
warehouseSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = {
  Category: mongoose.models.Category || mongoose.model('Category', categorySchema),
  Product: mongoose.models.Product || mongoose.model('Product', productSchema),
  Client: mongoose.models.Client || mongoose.model('Client', clientSchema),
  Supplier: mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema),
  Warehouse: mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema)
};
