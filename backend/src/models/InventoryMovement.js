const mongoose = require('mongoose');

const inventoryMovementSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  type: { type: String, required: true, enum: ['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'SALE', 'PURCHASE', 'RETURN', 'SALE_RETURN'] },
  quantity: { type: Number, required: true, min: 0.000001 },
  previousQuantity: { type: Number, required: true, min: 0 },
  newQuantity: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  referenceType: { type: String, trim: true, maxlength: 80, default: undefined },
  referenceId: { type: String, trim: true, maxlength: 120, default: undefined },
  saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: undefined },
  saleFolio: { type: String, trim: true, maxlength: 80, default: undefined },
  transferId: { type: String, trim: true, maxlength: 64, default: undefined },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

inventoryMovementSchema.index({ productId: 1, warehouseId: 1, createdAt: -1 });
inventoryMovementSchema.index({ warehouseId: 1, createdAt: -1 });
inventoryMovementSchema.index({ type: 1, createdAt: -1 });
inventoryMovementSchema.index({ createdAt: -1, _id: -1 });
inventoryMovementSchema.index({ referenceType: 1, referenceId: 1 });
inventoryMovementSchema.index({ transferId: 1 }, { sparse: true });

module.exports = mongoose.models.InventoryMovement || mongoose.model('InventoryMovement', inventoryMovementSchema);
