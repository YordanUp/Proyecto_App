const mongoose = require('mongoose');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const { Product, Warehouse } = require('../models/catalog');
const { recordAudit } = require('./auditService');

const MAX_PAGE_SIZE = 100;
const REFERENCE_TYPES = new Set(['manual', 'sale', 'purchase', 'return']);

function inventoryError(statusCode, errorCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

function idValue(value, field) {
  if (!mongoose.isValidObjectId(value)) throw inventoryError(400, 'VALIDATION_ERROR', `${field} no es válido`);
  return new mongoose.Types.ObjectId(value);
}

function positiveQuantity(value) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) throw inventoryError(400, 'VALIDATION_ERROR', 'La cantidad debe ser mayor a cero');
  return quantity;
}

function nonNegativeQuantity(value) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity < 0) throw inventoryError(400, 'VALIDATION_ERROR', 'La existencia objetivo debe ser un número igual o mayor a cero');
  return quantity;
}

function pagination(query) {
  const requestedPage = Number(query.page);
  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(query.limit) || 25)));
  return { page, limit, skip: (page - 1) * limit };
}

function reference(data = {}) {
  const referenceType = String(data.referenceType || 'manual').trim().toLowerCase();
  if (!REFERENCE_TYPES.has(referenceType)) throw inventoryError(400, 'INVALID_REFERENCE_TYPE', 'El tipo de documento relacionado no es válido');
  const referenceId = String(data.referenceId || '').trim();
  if (referenceId.length > 120) throw inventoryError(400, 'VALIDATION_ERROR', 'El documento relacionado es demasiado largo');
  return referenceId ? { referenceType, referenceId } : { referenceType: undefined, referenceId: undefined };
}

function reasonValue(value) {
  const reason = String(value || '').trim();
  if (!reason || reason.length > 500) throw inventoryError(400, 'VALIDATION_ERROR', 'El motivo es obligatorio y no puede superar 500 caracteres');
  return reason;
}

function serializeStock(stock) {
  const product = stock.productId && stock.productId._id ? stock.productId : null;
  const warehouse = stock.warehouseId && stock.warehouseId._id ? stock.warehouseId : null;
  const productId = String(product?._id || stock.productId);
  const warehouseId = String(warehouse?._id || stock.warehouseId);
  const quantity = Number(stock.quantity) || 0;
  const reservedQuantity = Number(stock.reservedQuantity) || 0;
  const minimumStock = Number(stock.minimumStock) || 0;
  return {
    id: String(stock._id), productId, warehouseId,
    product: product ? { id: productId, code: product.code, name: product.name } : null,
    warehouse: warehouse ? { id: warehouseId, name: warehouse.name } : null,
    quantity, stock: quantity, reservedQuantity, availableQuantity: quantity - reservedQuantity,
    minimumStock, minStock: minimumStock, status: quantity - reservedQuantity <= minimumStock ? 'low' : 'available',
    updatedAt: stock.updatedAt
  };
}

function serializeMovement(movement) {
  const product = movement.productId && movement.productId._id ? movement.productId : null;
  const warehouse = movement.warehouseId && movement.warehouseId._id ? movement.warehouseId : null;
  const user = movement.userId && movement.userId._id ? movement.userId : null;
  return {
    id: String(movement._id),
    productId: String(product?._id || movement.productId),
    product: product ? { id: String(product._id), code: product.code, name: product.name } : null,
    warehouseId: String(warehouse?._id || movement.warehouseId),
    warehouse: warehouse ? { id: String(warehouse._id), name: warehouse.name } : null,
    type: movement.type, quantity: movement.quantity, previousQuantity: movement.previousQuantity,
    newQuantity: movement.newQuantity, reason: movement.reason,
    referenceType: movement.referenceType, referenceId: movement.referenceId,
    transferId: movement.transferId, userId: String(user?._id || movement.userId),
    user: user ? { id: String(user._id), name: user.name } : null, createdAt: movement.createdAt
  };
}

async function withInventoryTransaction(operation) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(() => operation(session));
    } catch (error) {
      // Concurrent first writes can race on the unique (product, warehouse) stock index.
      if (error.code !== 11000 || attempt === 2) throw error;
    } finally {
      await session.endSession();
    }
  }
  throw inventoryError(409, 'INVENTORY_CONFLICT', 'No fue posible aplicar el movimiento por una operación concurrente');
}

async function activeReferences(productId, warehouseId, session) {
  const [product, warehouse] = await Promise.all([
    Product.findOne({ _id: productId, status: 'active' }).select('_id minStock').session(session),
    Warehouse.findOne({ _id: warehouseId, status: 'active' }).select('_id').session(session)
  ]);
  if (!product) throw inventoryError(404, 'PRODUCT_NOT_FOUND', 'El producto no existe o está inactivo');
  if (!warehouse) throw inventoryError(404, 'WAREHOUSE_NOT_FOUND', 'El almacén no existe o está inactivo');
  return { product, warehouse };
}

async function ensureStock(product, warehouse, session) {
  await InventoryStock.updateOne(
    { productId: product._id, warehouseId: warehouse._id },
    { $setOnInsert: { productId: product._id, warehouseId: warehouse._id, quantity: 0, reservedQuantity: 0, minimumStock: product.minStock || 0 } },
    { upsert: true, session, runValidators: true }
  );
  return InventoryStock.findOne({ productId: product._id, warehouseId: warehouse._id }).session(session);
}

async function createMovement({ productId, warehouseId, type, quantity, previousQuantity, newQuantity, reason, referenceType, referenceId, transferId = null, userId, session }) {
  const [movement] = await InventoryMovement.create([{
    productId, warehouseId, type, quantity, previousQuantity, newQuantity, reason,
    referenceType, referenceId, transferId, userId
  }], { session });
  return movement;
}

async function auditMovement({ userId, action, movement, stockBefore, stockAfter, session }) {
  await recordAudit({
    userId, action, module: 'inventory', recordId: movement.id,
    before: { productId: movement.productId, warehouseId: movement.warehouseId, quantity: stockBefore.quantity, reservedQuantity: stockBefore.reservedQuantity },
    after: { movementId: movement.id, type: movement.type, quantity: movement.quantity, previousQuantity: movement.previousQuantity, newQuantity: movement.newQuantity, reason: movement.reason, referenceType: movement.referenceType, referenceId: movement.referenceId, quantityOnHand: stockAfter.quantity },
    session
  });
}

async function addEntry(data, actorId) {
  const productId = idValue(data.productId, 'productId');
  const warehouseId = idValue(data.warehouseId, 'warehouseId');
  const userId = idValue(actorId, 'usuario');
  const quantity = positiveQuantity(data.quantity);
  const reason = reasonValue(data.reason);
  const { referenceType, referenceId } = reference(data);
  return withInventoryTransaction(async session => {
    const { product, warehouse } = await activeReferences(productId, warehouseId, session);
    await ensureStock(product, warehouse, session);
    const before = await InventoryStock.findOne({ productId, warehouseId }).session(session);
    const after = await InventoryStock.findOneAndUpdate(
      { productId, warehouseId },
      { $inc: { quantity }, $set: { minimumStock: product.minStock || 0 } },
      { new: true, runValidators: true, session }
    );
    const movement = await createMovement({ productId, warehouseId, type: 'IN', quantity, previousQuantity: before.quantity, newQuantity: after.quantity, reason, referenceType, referenceId, userId, session });
    await auditMovement({ userId, action: 'inventory.entry', movement, stockBefore: before, stockAfter: after, session });
    return { movement: serializeMovement(movement), stock: serializeStock(after) };
  });
}

async function addExit(data, actorId) {
  const productId = idValue(data.productId, 'productId');
  const warehouseId = idValue(data.warehouseId, 'warehouseId');
  const userId = idValue(actorId, 'usuario');
  const quantity = positiveQuantity(data.quantity);
  const reason = reasonValue(data.reason);
  const { referenceType, referenceId } = reference(data);
  return withInventoryTransaction(async session => {
    const { product, warehouse } = await activeReferences(productId, warehouseId, session);
    await ensureStock(product, warehouse, session);
    const before = await InventoryStock.findOne({ productId, warehouseId }).session(session);
    const after = await InventoryStock.findOneAndUpdate({
      productId, warehouseId,
      $expr: { $gte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, quantity] }
    }, { $inc: { quantity: -quantity } }, { new: true, runValidators: true, session });
    if (!after) throw inventoryError(409, 'INSUFFICIENT_STOCK', 'La salida supera las existencias disponibles');
    const movement = await createMovement({ productId, warehouseId, type: 'OUT', quantity, previousQuantity: before.quantity, newQuantity: after.quantity, reason, referenceType, referenceId, userId, session });
    await auditMovement({ userId, action: 'inventory.exit', movement, stockBefore: before, stockAfter: after, session });
    return { movement: serializeMovement(movement), stock: serializeStock(after) };
  });
}

async function adjustStock(data, actorId) {
  const productId = idValue(data.productId, 'productId');
  const warehouseId = idValue(data.warehouseId, 'warehouseId');
  const userId = idValue(actorId, 'usuario');
  const newQuantity = nonNegativeQuantity(data.newQuantity);
  const reason = reasonValue(data.reason);
  const { referenceType, referenceId } = reference(data);
  return withInventoryTransaction(async session => {
    const { product, warehouse } = await activeReferences(productId, warehouseId, session);
    await ensureStock(product, warehouse, session);
    const before = await InventoryStock.findOne({ productId, warehouseId }).session(session);
    if (newQuantity === before.quantity) throw inventoryError(400, 'NO_STOCK_CHANGE', 'La existencia objetivo es igual a la existencia actual');
    const after = await InventoryStock.findOneAndUpdate(
      { _id: before._id, reservedQuantity: { $lte: newQuantity } },
      { $set: { quantity: newQuantity, minimumStock: product.minStock || 0 } },
      { new: true, runValidators: true, session }
    );
    if (!after) throw inventoryError(409, 'RESERVED_STOCK_CONFLICT', 'La existencia objetivo no puede ser menor a la cantidad reservada');
    const movement = await createMovement({ productId, warehouseId, type: 'ADJUSTMENT', quantity: Math.abs(newQuantity - before.quantity), previousQuantity: before.quantity, newQuantity: after.quantity, reason, referenceType, referenceId, userId, session });
    await auditMovement({ userId, action: 'inventory.adjustment', movement, stockBefore: before, stockAfter: after, session });
    return { movement: serializeMovement(movement), stock: serializeStock(after) };
  });
}

async function transferStock(data, actorId) {
  const productId = idValue(data.productId, 'productId');
  const fromWarehouseId = idValue(data.fromWarehouseId, 'fromWarehouseId');
  const toWarehouseId = idValue(data.toWarehouseId, 'toWarehouseId');
  const userId = idValue(actorId, 'usuario');
  if (fromWarehouseId.equals(toWarehouseId)) throw inventoryError(400, 'INVALID_TRANSFER', 'El almacén de origen y destino deben ser distintos');
  const quantity = positiveQuantity(data.quantity);
  const reason = reasonValue(data.reason);
  const referenceInfo = reference({ ...data, referenceType: data.referenceType || 'manual' });
  const transferId = new mongoose.Types.ObjectId().toString();
  return withInventoryTransaction(async session => {
    const sourceRefs = await activeReferences(productId, fromWarehouseId, session);
    const destinationRefs = await activeReferences(productId, toWarehouseId, session);
    const product = sourceRefs.product;
    await ensureStock(product, sourceRefs.warehouse, session);
    await ensureStock(product, destinationRefs.warehouse, session);
    const sourceBefore = await InventoryStock.findOne({ productId, warehouseId: fromWarehouseId }).session(session);
    const destinationBefore = await InventoryStock.findOne({ productId, warehouseId: toWarehouseId }).session(session);
    const sourceAfter = await InventoryStock.findOneAndUpdate({
      productId, warehouseId: fromWarehouseId,
      $expr: { $gte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, quantity] }
    }, { $inc: { quantity: -quantity } }, { new: true, runValidators: true, session });
    if (!sourceAfter) throw inventoryError(409, 'INSUFFICIENT_STOCK', 'La transferencia supera las existencias disponibles del almacén de origen');
    const destinationAfter = await InventoryStock.findOneAndUpdate(
      { productId, warehouseId: toWarehouseId },
      { $inc: { quantity }, $set: { minimumStock: product.minStock || 0 } },
      { new: true, runValidators: true, session }
    );
    if (!destinationAfter) throw inventoryError(409, 'INVENTORY_CONFLICT', 'No fue posible actualizar el almacén destino');
    const outMovement = await createMovement({ productId, warehouseId: fromWarehouseId, type: 'TRANSFER_OUT', quantity, previousQuantity: sourceBefore.quantity, newQuantity: sourceAfter.quantity, reason, referenceType: 'transfer', referenceId: transferId, transferId, userId, session });
    const inMovement = await createMovement({ productId, warehouseId: toWarehouseId, type: 'TRANSFER_IN', quantity, previousQuantity: destinationBefore.quantity, newQuantity: destinationAfter.quantity, reason, referenceType: 'transfer', referenceId: transferId, transferId, userId, session });
    await recordAudit({
      userId, action: 'inventory.transfer', module: 'inventory', recordId: transferId,
      before: { productId, fromWarehouseId, sourceQuantity: sourceBefore.quantity, toWarehouseId, destinationQuantity: destinationBefore.quantity },
      after: { transferId, quantity, reason, referenceType: referenceInfo.referenceType, referenceId: referenceInfo.referenceId, outMovementId: outMovement.id, inMovementId: inMovement.id, sourceQuantity: sourceAfter.quantity, destinationQuantity: destinationAfter.quantity },
      session
    });
    return { transferId, movements: [serializeMovement(outMovement), serializeMovement(inMovement)], stocks: [serializeStock(sourceAfter), serializeStock(destinationAfter)] };
  });
}

function dateFilter(query) {
  const filter = {};
  if (query.from || query.to) {
    const range = {};
    if (query.from) {
      const from = new Date(query.from);
      if (!Number.isFinite(from.getTime())) throw inventoryError(400, 'VALIDATION_ERROR', 'La fecha inicial no es válida');
      range.$gte = from;
    }
    if (query.to) {
      const to = new Date(query.to);
      if (!Number.isFinite(to.getTime())) throw inventoryError(400, 'VALIDATION_ERROR', 'La fecha final no es válida');
      range.$lte = to;
    }
    if (range.$gte && range.$lte && range.$gte > range.$lte) throw inventoryError(400, 'VALIDATION_ERROR', 'El rango de fechas no es válido');
    filter.createdAt = range;
  }
  return filter;
}

async function productIdsForSearch(search) {
  const value = String(search || '').trim().slice(0, 100);
  if (!value) return null;
  const safe = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Product.find({ $or: [{ name: { $regex: safe, $options: 'i' } }, { code: { $regex: safe, $options: 'i' } }] }).select('_id').limit(1000).lean().then(items => items.map(item => item._id));
}

async function listInventory(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = {};
  if (query.productId) filter.productId = idValue(query.productId, 'productId');
  if (query.warehouseId) filter.warehouseId = idValue(query.warehouseId, 'warehouseId');
  if (query.lowStock === 'true') filter.$expr = { $lte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, '$minimumStock'] };
  const productIds = await productIdsForSearch(query.search);
  if (productIds) filter.productId = filter.productId ? { $in: productIds.filter(id => id.equals(filter.productId)) } : { $in: productIds };
  const sortField = ['quantity', 'minimumStock', 'updatedAt'].includes(query.sort) ? query.sort : 'updatedAt';
  const direction = query.order === 'asc' ? 1 : -1;
  const [stocks, total] = await Promise.all([
    InventoryStock.find(filter).populate('productId', 'code name status').populate('warehouseId', 'name status').sort({ [sortField]: direction, _id: 1 }).skip(skip).limit(limit).lean(),
    InventoryStock.countDocuments(filter)
  ]);
  return { items: stocks.map(serializeStock), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function listWarehouses() {
  return Warehouse.find({ status: 'active' }).select('name address status').sort({ name: 1 }).lean()
    .then(items => items.map(item => ({ id: String(item._id), name: item.name, address: item.address, status: item.status })));
}

async function listMovements(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = dateFilter(query);
  if (query.productId) filter.productId = idValue(query.productId, 'productId');
  if (query.warehouseId) filter.warehouseId = idValue(query.warehouseId, 'warehouseId');
  if (query.type) {
    const allowedTypes = InventoryMovement.schema.path('type').enumValues;
    if (!allowedTypes.includes(query.type)) throw inventoryError(400, 'VALIDATION_ERROR', 'El tipo de movimiento no es válido');
    filter.type = query.type;
  }
  const productIds = await productIdsForSearch(query.search);
  if (productIds) filter.productId = filter.productId ? { $in: productIds.filter(id => id.equals(filter.productId)) } : { $in: productIds };
  const sortDirection = query.order === 'asc' ? 1 : -1;
  const [movements, total] = await Promise.all([
    InventoryMovement.find(filter).populate('productId', 'code name').populate('warehouseId', 'name').populate('userId', 'name').sort({ createdAt: sortDirection, _id: sortDirection }).skip(skip).limit(limit).lean(),
    InventoryMovement.countDocuments(filter)
  ]);
  return { items: movements.map(serializeMovement), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

module.exports = { listInventory, listWarehouses, listMovements, addEntry, addExit, adjustStock, transferStock, inventoryError };
