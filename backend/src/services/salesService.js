const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Sequence = require('../models/Sequence');
const { Client, Product, Warehouse } = require('../models/catalog');
const inventoryService = require('./inventoryService');
const { recordAudit } = require('./auditService');
const financeService = require('./financeService');

const MAX_PAGE_SIZE = 100;

function salesError(statusCode, errorCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) throw salesError(400, 'VALIDATION_ERROR', `${field} no es válido`);
  return new mongoose.Types.ObjectId(value);
}

function money(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function runTransaction(operation) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(() => operation(session));
    } catch (error) {
      if (error.code !== 11000 || attempt === 2) throw error;
    } finally {
      await session.endSession();
    }
  }
  throw salesError(409, 'SALE_CONFLICT', 'La operación de venta entró en conflicto con otra solicitud');
}

function pagination(query = {}) {
  const requestedPage = Number(query.page);
  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(query.limit) || 25)));
  return { page, limit, skip: (page - 1) * limit };
}

function serializeSale(sale) {
  const customer = sale.customer && typeof sale.customer === 'object' && 'name' in sale.customer ? sale.customer : null;
  const createdBy = sale.createdBy && typeof sale.createdBy === 'object' && 'name' in sale.createdBy ? sale.createdBy : null;
  return {
    id: String(sale._id), folio: sale.folio,
    customer: customer ? { id: String(customer._id), name: customer.name, email: customer.email } : { id: String(sale.customer) },
    customerId: String(customer?._id || sale.customer), items: (sale.items || []).map(item => {
      const product = item.product && typeof item.product === 'object' && 'name' in item.product ? item.product : null;
      const warehouse = item.warehouse && typeof item.warehouse === 'object' && 'name' in item.warehouse ? item.warehouse : null;
      return {
        productId: String(product?._id || item.product),
        product: product ? { id: String(product._id), code: product.code, name: product.name } : null,
        warehouseId: String(warehouse?._id || item.warehouse),
        warehouse: warehouse ? { id: String(warehouse._id), name: warehouse.name } : null,
        productNameSnapshot: item.productNameSnapshot, skuSnapshot: item.skuSnapshot,
        quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate,
        tax: item.tax, subtotal: item.subtotal, total: item.total
      };
    }),
    subtotal: sale.subtotal, taxes: sale.taxes, total: sale.total, status: sale.status,
    createdBy: createdBy ? { id: String(createdBy._id), name: createdBy.name } : String(sale.createdBy),
    confirmedAt: sale.confirmedAt, cancelledAt: sale.cancelledAt,
    createdAt: sale.createdAt, updatedAt: sale.updatedAt
  };
}

async function populateSale(query) {
  return query.populate('customer', 'name email').populate('createdBy', 'name')
    .populate('items.product', 'code name status').populate('items.warehouse', 'name status');
}

function searchPattern(value) {
  return String(value || '').trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listSales(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = {};
  if (query.status) {
    if (!['draft', 'confirmed', 'cancelled'].includes(query.status)) throw salesError(400, 'VALIDATION_ERROR', 'El estado de venta no es válido');
    filter.status = query.status;
  }
  if (query.customerId) filter.customer = objectId(query.customerId, 'customerId');
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) {
      const from = new Date(query.from);
      if (!Number.isFinite(from.getTime())) throw salesError(400, 'VALIDATION_ERROR', 'La fecha inicial no es válida');
      filter.createdAt.$gte = from;
    }
    if (query.to) {
      const to = new Date(query.to);
      if (!Number.isFinite(to.getTime())) throw salesError(400, 'VALIDATION_ERROR', 'La fecha final no es válida');
      filter.createdAt.$lte = to;
    }
    if (filter.createdAt.$gte && filter.createdAt.$lte && filter.createdAt.$gte > filter.createdAt.$lte) throw salesError(400, 'VALIDATION_ERROR', 'El rango de fechas no es válido');
  }
  const search = searchPattern(query.search);
  if (search) {
    const matchingClients = await Client.find({ name: { $regex: search, $options: 'i' } }).select('_id').limit(1000).lean();
    filter.$or = [{ folio: { $regex: search, $options: 'i' } }, { customer: { $in: matchingClients.map(client => client._id) } }];
  }
  const sortField = ['folio', 'total', 'createdAt', 'status'].includes(query.sort) ? query.sort : 'createdAt';
  const direction = query.order === 'asc' ? 1 : -1;
  const [sales, total] = await Promise.all([
    populateSale(Sale.find(filter).sort({ [sortField]: direction, _id: -1 }).skip(skip).limit(limit).lean()),
    Sale.countDocuments(filter)
  ]);
  return { items: sales.map(serializeSale), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function getSaleById(id) {
  const saleId = objectId(id, 'id');
  const sale = await populateSale(Sale.findById(saleId).lean());
  return sale ? serializeSale(sale) : null;
}

async function calculateItems(inputItems, session) {
  if (!Array.isArray(inputItems) || inputItems.length === 0 || inputItems.length > 100) throw salesError(400, 'VALIDATION_ERROR', 'La venta debe incluir entre 1 y 100 productos');
  const items = [];
  for (const [index, input] of inputItems.entries()) {
    const productId = objectId(input?.productId || input?.product, `items[${index}].productId`);
    const warehouseId = objectId(input?.warehouseId || input?.warehouse, `items[${index}].warehouseId`);
    const quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw salesError(400, 'VALIDATION_ERROR', `La cantidad del producto ${index + 1} debe ser mayor a cero`);
    const product = await Product.findOne({ _id: productId, status: 'active' }).session(session);
    const warehouse = await Warehouse.findOne({ _id: warehouseId, status: 'active' }).session(session);
    if (!product) throw salesError(404, 'PRODUCT_NOT_FOUND', `El producto de la línea ${index + 1} no existe o está inactivo`);
    if (!warehouse) throw salesError(404, 'WAREHOUSE_NOT_FOUND', `El almacén de la línea ${index + 1} no existe o está inactivo`);
    const unitPrice = input.unitPrice === undefined ? Number(product.salePrice) : Number(input.unitPrice);
    const taxRate = input.taxRate === undefined ? 0 : Number(input.taxRate);
    if (!Number.isFinite(unitPrice) || unitPrice < Number(product.purchasePrice) || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      throw salesError(400, 'INVALID_PRICE', `El precio o impuesto del producto ${index + 1} no es válido`);
    }
    const subtotal = money(quantity * unitPrice);
    const tax = money(subtotal * taxRate / 100);
    items.push({ product: product._id, warehouse: warehouse._id, productNameSnapshot: product.name, skuSnapshot: product.code, quantity, unitPrice, taxRate, tax, subtotal, total: money(subtotal + tax) });
  }
  return items;
}

async function validateCustomer(customerId, session) {
  const customer = await Client.findOne({ _id: customerId, status: 'active' }).session(session);
  if (!customer) throw salesError(404, 'CUSTOMER_NOT_FOUND', 'El cliente no existe o está inactivo');
  return customer;
}

function totals(items) {
  const subtotal = money(items.reduce((sum, item) => sum + item.subtotal, 0));
  const taxes = money(items.reduce((sum, item) => sum + item.tax, 0));
  return { subtotal, taxes, total: money(subtotal + taxes) };
}

async function nextFolio(session) {
  const year = new Date().getUTCFullYear();
  const sequence = await Sequence.findOneAndUpdate({ _id: `sale:${year}` }, { $inc: { value: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session });
  return `VEN-${year}-${String(sequence.value).padStart(6, '0')}`;
}

async function createSale(data, actorId) {
  const customerId = objectId(data?.customerId || data?.customer, 'customerId');
  const createdBy = objectId(actorId, 'usuario');
  return runTransaction(async session => {
    const customer = await validateCustomer(customerId, session);
    const items = await calculateItems(data.items, session);
    const folio = await nextFolio(session);
    const saleValues = { folio, customer: customer._id, items, ...totals(items), status: 'draft', createdBy };
    const [sale] = await Sale.create([saleValues], { session });
    await recordAudit({ userId: createdBy, action: 'sale.created', module: 'sales', recordId: sale.id, after: saleValues, session });
    return serializeSale(sale);
  });
}

async function updateSale(id, data, actorId) {
  const saleId = objectId(id, 'id');
  const userId = objectId(actorId, 'usuario');
  return runTransaction(async session => {
    const sale = await Sale.findById(saleId).session(session);
    if (!sale) return null;
    if (sale.status !== 'draft') throw salesError(409, 'INVALID_SALE_TRANSITION', 'Solo se pueden editar ventas en borrador');
    const before = sale.toObject();
    if (data.customerId !== undefined || data.customer !== undefined) {
      sale.customer = await validateCustomer(objectId(data.customerId || data.customer, 'customerId'), session).then(customer => customer._id);
    }
    if (data.items !== undefined) sale.items = await calculateItems(data.items, session);
    Object.assign(sale, totals(sale.items));
    await sale.save({ session });
    await recordAudit({ userId, action: 'sale.updated', module: 'sales', recordId: sale.id, before, after: sale, session });
    return serializeSale(sale);
  });
}

async function confirmSale(id, actorId) {
  const saleId = objectId(id, 'id');
  const userId = objectId(actorId, 'usuario');
  return runTransaction(async session => {
    const sale = await Sale.findById(saleId).session(session);
    if (!sale) return null;
    if (sale.status !== 'draft') throw salesError(409, 'INVALID_SALE_TRANSITION', 'Solo se pueden confirmar ventas en borrador');
    await validateCustomer(sale.customer, session);
    for (const item of sale.items) {
      await inventoryService.consumeForSale({ productId: item.product, warehouseId: item.warehouse, quantity: item.quantity, saleId: sale.id, folio: sale.folio, userId, session });
    }
    const before = { status: sale.status, confirmedAt: sale.confirmedAt };
    sale.status = 'confirmed';
    sale.confirmedAt = new Date();
    await sale.save({ session });
    await financeService.createReceivableForSale({ sale, userId, session });
    await recordAudit({ userId, action: 'sale.confirmed', module: 'sales', recordId: sale.id, before, after: sale, session });
    return serializeSale(sale);
  });
}

async function cancelSale(id, actorId) {
  const saleId = objectId(id, 'id');
  const userId = objectId(actorId, 'usuario');
  return runTransaction(async session => {
    const sale = await Sale.findById(saleId).session(session);
    if (!sale) return null;
    if (!['draft', 'confirmed'].includes(sale.status)) throw salesError(409, 'INVALID_SALE_TRANSITION', 'La venta ya fue cancelada y no admite otra transición');
    const before = { status: sale.status, confirmedAt: sale.confirmedAt, cancelledAt: sale.cancelledAt };
    if (sale.status === 'confirmed') {
      await financeService.cancelReceivableForSale({ saleId: sale._id, userId, session });
      for (const item of sale.items) {
        await inventoryService.restoreForSale({ productId: item.product, warehouseId: item.warehouse, quantity: item.quantity, saleId: sale.id, folio: sale.folio, userId, session });
      }
    }
    sale.status = 'cancelled';
    sale.cancelledAt = new Date();
    await sale.save({ session });
    await recordAudit({ userId, action: 'sale.cancelled', module: 'sales', recordId: sale.id, before, after: sale, session });
    return serializeSale(sale);
  });
}

module.exports = { listSales, getSaleById, createSale, updateSale, confirmSale, cancelSale, salesError };
