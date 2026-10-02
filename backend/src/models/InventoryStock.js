const mongoose = require('mongoose');

const inventoryStockSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  reservedQuantity: { type: Number, required: true, min: 0, default: 0 },
  minimumStock: { type: Number, required: true, min: 0, default: 0 }
}, { timestamps: true, versionKey: false });

inventoryStockSchema.index({ productId: 1, warehouseId: 1 }, { unique: true });
inventoryStockSchema.index({ warehouseId: 1, productId: 1 });

module.exports = mongoose.models.InventoryStock || mongoose.model('InventoryStock', inventoryStockSchema);
