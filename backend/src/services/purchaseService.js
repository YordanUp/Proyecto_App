const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const Sequence = require('../models/Sequence');
const { Product, Supplier, Warehouse } = require('../models/catalog');
const inventoryService = require('./inventoryService');
const { recordAudit } = require('./auditService');

const MAX_PAGE_SIZE = 100;

function purchaseError(statusCode, errorCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) throw purchaseError(400, 'VALIDATION_ERROR', `${field} no es válido`);
  return new mongoose.Types.ObjectId(value);
}

function money(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }

async function runTransaction(operation) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const session = await mongoose.startSession();
    try { return await session.withTransaction(() => operation(session)); }
    catch (error) {
      if (error.code !== 11000 || attempt === 2) throw error;
    } finally { await session.endSession(); }
  }
  throw purchaseError(409, 'PURCHASE_CONFLICT', 'La compra entró en conflicto con otra operación concurrente');
}

function pagination(query = {}) {
  const requestedPage = Number(query.page);
  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(query.limit) || 25)));
  return { page, limit, skip: (page - 1) * limit };
}

function serializePurchase(purchase) {
  const supplier = purchase.supplier && typeof purchase.supplier === 'object' && 'name' in purchase.supplier ? purchase.supplier : null;
  const createdBy = purchase.createdBy && typeof purchase.createdBy === 'object' && 'name' in purchase.createdBy ? purchase.createdBy : null;
  return {
    id: String(purchase._id), folio: purchase.folio,
    supplier: supplier ? { id: String(supplier._id), name: supplier.name, email: supplier.email } : { id: String(purchase.supplier) },
    supplierId: String(supplier?._id || purchase.supplier),
    items: (purchase.items || []).map(item => {
      const product = item.product && typeof item.product === 'object' && 'name' in item.product ? item.product : null;
      const warehouse = item.warehouse && typeof item.warehouse === 'object' && 'name' in item.warehouse ? item.warehouse : null;
      return {
        productId: String(product?._id || item.product),
        product: product ? { id: String(product._id), code: product.code, name: product.name } : null,
        productNameSnapshot: item.productNameSnapshot, skuSnapshot: item.skuSnapshot,
        quantity: item.quantity, unitCost: item.unitCost, taxRate: item.taxRate, tax: item.tax,
        subtotal: item.subtotal, total: item.total,
        warehouseId: String(warehouse?._id || item.warehouse),
        warehouse: warehouse ? { id: String(warehouse._id), name: warehouse.name } : null
      };
    }),
    subtotal: purchase.subtotal, taxes: purchase.taxes, total: purchase.total,
    status: purchase.status, createdBy: createdBy ? { id: String(createdBy._id), name: createdBy.name } : String(purchase.createdBy),
    receivedAt: purchase.receivedAt, cancelledAt: purchase.cancelledAt,
    createdAt: purchase.createdAt, updatedAt: purchase.updatedAt
  };
}

function populatePurchase(query) {
  return query.populate('supplier', 'name email').populate('createdBy', 'name')
    .populate('items.product', 'code name status').populate('items.warehouse', 'name status');
}

function searchPattern(value) { return String(value || '').trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function listPurchases(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = {};
  if (query.status) {
    if (!['draft', 'ordered', 'received', 'cancelled'].includes(query.status)) throw purchaseError(400, 'VALIDATION_ERROR', 'El estado de compra no es válido');
    filter.status = query.status;
  }
  if (query.supplierId) filter.supplier = objectId(query.supplierId, 'supplierId');
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) { const from = new Date(query.from); if (!Number.isFinite(from.getTime())) throw purchaseError(400, 'VALIDATION_ERROR', 'La fecha inicial no es válida'); filter.createdAt.$gte = from; }
    if (query.to) { const to = new Date(query.to); if (!Number.isFinite(to.getTime())) throw purchaseError(400, 'VALIDATION_ERROR', 'La fecha final no es válida'); filter.createdAt.$lte = to; }
    if (filter.createdAt.$gte && filter.createdAt.$lte && filter.createdAt.$gte > filter.createdAt.$lte) throw purchaseError(400, 'VALIDATION_ERROR', 'El rango de fechas no es válido');
  }
  const search = searchPattern(query.search);
  if (search) {
    const suppliers = await Supplier.find({ name: { $regex: search, $options: 'i' } }).select('_id').limit(1000).lean();
    filter.$or = [{ folio: { $regex: search, $options: 'i' } }, { supplier: { $in: suppliers.map(item => item._id) } }];
  }
  const sortField = ['folio', 'total', 'createdAt', 'status'].includes(query.sort) ? query.sort : 'createdAt';
  const direction = query.order === 'asc' ? 1 : -1;
  const [purchases, total] = await Promise.all([
    populatePurchase(Purchase.find(filter).sort({ [sortField]: direction, _id: -1 }).skip(skip).limit(limit).lean()),
    Purchase.countDocuments(filter)
  ]);
  return { items: purchases.map(serializePurchase), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function getPurchaseById(id) {
  const purchaseId = objectId(id, 'id');
  const purchase = await populatePurchase(Purchase.findById(purchaseId).lean());
  return purchase ? serializePurchase(purchase) : null;
}

async function validateSupplier(id, session) {
  const supplier = await Supplier.findOne({ _id: id, status: 'active' }).session(session);
  if (!supplier) throw purchaseError(404, 'SUPPLIER_NOT_FOUND', 'El proveedor no existe o está inactivo');
  return supplier;
}

async function calculateItems(inputItems, session) {
  if (!Array.isArray(inputItems) || inputItems.length === 0 || inputItems.length > 100) throw purchaseError(400, 'VALIDATION_ERROR', 'La compra debe incluir entre 1 y 100 productos');
  const items = [];
  for (const [index, input] of inputItems.entries()) {
    const productId = objectId(input?.productId || input?.product, `items[${index}].productId`);
    const warehouseId = objectId(input?.warehouseId || input?.warehouse, `items[${index}].warehouseId`);
    const quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw purchaseError(400, 'VALIDATION_ERROR', `La cantidad del producto ${index + 1} debe ser mayor a cero`);
    const [product, warehouse] = await Promise.all([
      Product.findOne({ _id: productId, status: 'active' }).session(session),
      Warehouse.findOne({ _id: warehouseId, status: 'active' }).session(session)
    ]);
    if (!product) throw purchaseError(404, 'PRODUCT_NOT_FOUND', `El producto de la línea ${index + 1} no existe o está inactivo`);
    if (!warehouse) throw purchaseError(404, 'WAREHOUSE_NOT_FOUND', `El almacén de la línea ${index + 1} no existe o está inactivo`);
    const unitCost = input.unitCost === undefined ? Number(product.purchasePrice) : Number(input.unitCost);
    const taxRate = input.taxRate === undefined ? 0 : Number(input.taxRate);
    if (!Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw purchaseError(400, 'INVALID_COST', `El costo o impuesto del producto ${index + 1} no es válido`);
    const subtotal = money(quantity * unitCost);
    const tax = money(subtotal * taxRate / 100);
    items.push({ product: product._id, warehouse: warehouse._id, productNameSnapshot: product.name, skuSnapshot: product.code, quantity, unitCost, taxRate, tax, subtotal, total: money(subtotal + tax) });
  }
  return items;
}

function totals(items) {
  const subtotal = money(items.reduce((sum, item) => sum + item.subtotal, 0));
  const taxes = money(items.reduce((sum, item) => sum + item.tax, 0));
  return { subtotal, taxes, total: money(subtotal + taxes) };
}

async function nextFolio(session) {
  const year = new Date().getUTCFullYear();
  const sequence = await Sequence.findOneAndUpdate({ _id: `purchase:${year}` }, { $inc: { value: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session });
  return `COM-${year}-${String(sequence.value).padStart(6, '0')}`;
}

async function createPurchase(data, actorId) {
  const supplierId = objectId(data?.supplierId || data?.supplier, 'supplierId');
  const createdBy = objectId(actorId, 'usuario');
  return runTransaction(async session => {
    const supplier = await validateSupplier(supplierId, session);
    const items = await calculateItems(data.items, session);
    const values = { folio: await nextFolio(session), supplier: supplier._id, items, ...totals(items), status: 'draft', createdBy };
    const [purchase] = await Purchase.create([values], { session });
    await recordAudit({ userId: createdBy, action: 'purchase.created', module: 'purchases', recordId: purchase.id, after: values, session });
    return serializePurchase(purchase);
  });
}

async function updatePurchase(id, data, actorId) {
  const purchaseId = objectId(id, 'id');
  const userId = objectId(actorId, 'usuario');
  return runTransaction(async session => {
    const purchase = await Purchase.findById(purchaseId).session(session);
    if (!purchase) return null;
    if (purchase.status !== 'draft') throw purchaseError(409, 'INVALID_PURCHASE_TRANSITION', 'Solo se pueden editar compras en borrador');
    const before = purchase.toObject();
    if (data.supplierId !== undefined || data.supplier !== undefined) purchase.supplier = (await validateSupplier(objectId(data.supplierId || data.supplier, 'supplierId'), session))._id;
    if (data.items !== undefined) purchase.items = await calculateItems(data.items, session);
    Object.assign(purchase, totals(purchase.items));
    await purchase.save({ session });
    await recordAudit({ userId, action: 'purchase.updated', module: 'purchases', recordId: purchase.id, before, after: purchase, session });
    return serializePurchase(purchase);
  });
}

async function orderPurchase(id, actorId) {
  const purchaseId = objectId(id, 'id');
  const userId = objectId(actorId, 'usuario');
  return runTransaction(async session => {
    const purchase = await Purchase.findById(purchaseId).session(session);
    if (!purchase) return null;
    if (purchase.status !== 'draft') throw purchaseError(409, 'INVALID_PURCHASE_TRANSITION', 'Solo se pueden ordenar compras en borrador');
    const before = { status: purchase.status };
    purchase.status = 'ordered';
    await purchase.save({ session });
    await recordAudit({ userId, action: 'purchase.ordered', module: 'purchases', recordId: purchase.id, before, after: purchase, session });
    return serializePurchase(purchase);
  });
}

async function receivePurchase(id, actorId) {
  const purchaseId = objectId(id, 'id');
  const userId = objectId(actorId, 'usuario');
  return runTransaction(async session => {
    const purchase = await Purchase.findById(purchaseId).session(session);
    if (!purchase) return null;
    if (purchase.status !== 'ordered') throw purchaseError(409, purchase.status === 'received' ? 'PURCHASE_ALREADY_RECEIVED' : 'INVALID_PURCHASE_TRANSITION', purchase.status === 'received' ? 'La compra ya fue recibida' : 'Solo se pueden recibir compras ordenadas');
    await validateSupplier(purchase.supplier, session);
    for (const item of purchase.items) {
      await inventoryService.receiveForPurchase({ productId: item.product, warehouseId: item.warehouse, quantity: item.quantity, purchaseId: purchase.id, folio: purchase.folio, userId, session });
    }
    const before = { status: purchase.status, receivedAt: purchase.receivedAt };
    purchase.status = 'received';
    purchase.receivedAt = new Date();
    await purchase.save({ session });
    await recordAudit({ userId, action: 'purchase.received', module: 'purchases', recordId: purchase.id, before, after: purchase, session });
    return serializePurchase(purchase);
  });
}

async function cancelPurchase(id, actorId) {
  const purchaseId = objectId(id, 'id');
  const userId = objectId(actorId, 'usuario');
  return runTransaction(async session => {
    const purchase = await Purchase.findById(purchaseId).session(session);
    if (!purchase) return null;
    if (!['draft', 'ordered'].includes(purchase.status)) throw purchaseError(409, 'INVALID_PURCHASE_TRANSITION', 'Las compras recibidas o canceladas no se pueden cancelar directamente');
    const before = { status: purchase.status, cancelledAt: purchase.cancelledAt };
    purchase.status = 'cancelled';
    purchase.cancelledAt = new Date();
    await purchase.save({ session });
    await recordAudit({ userId, action: 'purchase.cancelled', module: 'purchases', recordId: purchase.id, before, after: purchase, session });
    return serializePurchase(purchase);
  });
}

module.exports = { listPurchases, getPurchaseById, createPurchase, updatePurchase, orderPurchase, receivePurchase, cancelPurchase, purchaseError };
