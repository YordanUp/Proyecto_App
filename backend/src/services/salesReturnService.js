const mongoose = require('mongoose');
const SalesReturn = require('../models/SalesReturn');
const Sale = require('../models/Sale');
const Sequence = require('../models/Sequence');
const { Client } = require('../models/catalog');
const inventoryService = require('./inventoryService');
const financeService = require('./financeService');
const { recordAudit } = require('./auditService');
const { notifyPermission } = require('./notificationService');
const { salesError, objectId, runTransaction } = require('./salesService');

const MAX_PAGE_SIZE = 100;
const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

async function nextFolio(session) {
  const year = new Date().getUTCFullYear();
  const sequence = await Sequence.findOneAndUpdate({ _id: `sales-return:${year}` }, { $inc: { value: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session });
  return `DEV-${year}-${String(sequence.value).padStart(6, '0')}`;
}

function validateRequest(data) {
  objectId(data?.saleId, 'saleId');
  const reason = String(data?.reason || '').trim();
  const notes = String(data?.notes || '').trim();
  if (!reason || reason.length > 300 || notes.length > 1000) throw salesError(400, 'VALIDATION_ERROR', 'El motivo es obligatorio y las notas no pueden superar 1000 caracteres');
  if (!Array.isArray(data?.items) || !data.items.length || data.items.length > 100) throw salesError(400, 'VALIDATION_ERROR', 'La devolución debe incluir entre 1 y 100 partidas');
  for (const [index, item] of data.items.entries()) {
    objectId(item?.productId, `items[${index}].productId`);
    objectId(item?.warehouseId, `items[${index}].warehouseId`);
    if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) throw salesError(400, 'VALIDATION_ERROR', `La cantidad de la partida ${index + 1} debe ser mayor a cero`);
    if (item.saleLineIndex !== undefined && (!Number.isInteger(Number(item.saleLineIndex)) || Number(item.saleLineIndex) < 0)) throw salesError(400, 'VALIDATION_ERROR', `La línea de la partida ${index + 1} no es válida`);
  }
  return { reason, notes };
}

function buildReturnItems(sale, inputItems, existingReturns) {
  const returned = new Map();
  const returnedTotals = new Map();
  for (const prior of existingReturns) for (const item of prior.items) {
    const key = Number(item.saleLineIndex);
    returned.set(key, (returned.get(key) || 0) + Number(item.quantity));
    const priorTotals = returnedTotals.get(key) || { subtotal: 0, tax: 0 };
    priorTotals.subtotal += Number(item.subtotal);
    priorTotals.tax += Number(item.tax);
    returnedTotals.set(key, priorTotals);
  }

  const requested = new Map();
  for (const input of inputItems) {
    const matching = sale.items.map((line, index) => ({ line, index }))
      .filter(({ line }) => String(line.product) === String(input.productId) && String(line.warehouse) === String(input.warehouseId));
    if (!matching.length) throw salesError(400, 'RETURN_LINE_NOT_IN_SALE', 'Una partida no pertenece a la venta original');
    let selected;
    if (input.saleLineIndex !== undefined) {
      selected = matching.find(({ index }) => index === Number(input.saleLineIndex));
      if (!selected) throw salesError(400, 'RETURN_LINE_NOT_IN_SALE', 'La línea indicada no coincide con el producto y almacén de la venta');
    } else if (matching.length === 1) selected = matching[0];
    else throw salesError(400, 'AMBIGUOUS_SALE_LINE', 'La venta repite producto y almacén; indica saleLineIndex para identificar la partida');
    const lineKey = selected.index;
    requested.set(lineKey, (requested.get(lineKey) || 0) + Number(input.quantity));
  }

  const items = [];
  for (const [lineIndex, quantity] of requested) {
    const line = sale.items[lineIndex];
    const alreadyReturned = returned.get(lineIndex) || 0;
    const available = Number(line.quantity) - alreadyReturned;
    if (quantity > available + 1e-8) throw salesError(409, 'RETURN_QUANTITY_EXCEEDED', `La cantidad excede lo disponible en la línea ${lineIndex + 1} (disponible: ${available})`);
    const completesLine = Math.abs(alreadyReturned + quantity - Number(line.quantity)) <= 1e-8;
    const priorTotals = returnedTotals.get(lineIndex) || { subtotal: 0, tax: 0 };
    const subtotal = completesLine ? money(Number(line.subtotal) - priorTotals.subtotal) : money(quantity * Number(line.unitPrice));
    const tax = completesLine ? money(Number(line.tax) - priorTotals.tax) : money(subtotal * Number(line.taxRate) / 100);
    items.push({ saleLineIndex: lineIndex, product: line.product, warehouse: line.warehouse,
      productNameSnapshot: line.productNameSnapshot, skuSnapshot: line.skuSnapshot,
      quantity, unitPrice: line.unitPrice, taxRate: line.taxRate, subtotal, tax, total: money(subtotal + tax) });
  }
  return items;
}

function serialize(item) {
  const sale = item.sale && typeof item.sale === 'object' && 'folio' in item.sale ? item.sale : null;
  const customer = item.customer && typeof item.customer === 'object' && 'name' in item.customer ? item.customer : null;
  const creator = item.createdBy && typeof item.createdBy === 'object' && 'name' in item.createdBy ? item.createdBy : null;
  return {
    id: String(item._id), folio: item.folio,
    saleId: String(sale?._id || item.sale), sale: sale ? { id: String(sale._id), folio: sale.folio } : null,
    customerId: String(customer?._id || item.customer), customer: customer ? { id: String(customer._id), name: customer.name } : null,
    items: (item.items || []).map(line => {
      const product = line.product && typeof line.product === 'object' && 'name' in line.product ? line.product : null;
      const warehouse = line.warehouse && typeof line.warehouse === 'object' && 'name' in line.warehouse ? line.warehouse : null;
      return { saleLineIndex: line.saleLineIndex, productId: String(product?._id || line.product), product: product ? { id: String(product._id), code: product.code, name: product.name } : null,
        warehouseId: String(warehouse?._id || line.warehouse), warehouse: warehouse ? { id: String(warehouse._id), name: warehouse.name } : null,
        productNameSnapshot: line.productNameSnapshot, skuSnapshot: line.skuSnapshot, quantity: line.quantity, unitPrice: line.unitPrice,
        taxRate: line.taxRate, subtotal: line.subtotal, tax: line.tax, total: line.total };
    }),
    reason: item.reason, notes: item.notes, status: item.status, subtotal: item.subtotal, taxes: item.taxes, total: item.total,
    createdBy: creator ? { id: String(creator._id), name: creator.name } : String(item.createdBy), processedAt: item.processedAt, createdAt: item.createdAt
  };
}

function populate(query) {
  return query.populate('sale', 'folio').populate('customer', 'name email')
    .populate('createdBy', 'name').populate('items.product', 'code name').populate('items.warehouse', 'name');
}

async function createSalesReturn(data, actorId) {
  const { reason, notes } = validateRequest(data);
  const saleId = objectId(data.saleId, 'saleId');
  const userId = objectId(actorId, 'usuario');
  return runTransaction(async session => {
    // This write serializes return attempts on the same confirmed sale. A retried transaction
    // recalculates the remaining quantity after the winning return commits.
    const sale = await Sale.findOneAndUpdate({ _id: saleId, status: 'confirmed' }, { $inc: { returnRevision: 1 } }, { new: true, session, runValidators: true, timestamps: false });
    if (!sale) {
      const exists = await Sale.exists({ _id: saleId }).session(session);
      if (!exists) throw salesError(404, 'SALE_NOT_FOUND', 'La venta no existe');
      throw salesError(409, 'SALE_NOT_RETURNABLE', 'Solo se pueden devolver ventas confirmadas');
    }
    const priorReturns = await SalesReturn.find({ sale: saleId, status: 'processed' }).session(session).lean();
    const items = buildReturnItems(sale, data.items, priorReturns);
    const subtotal = money(items.reduce((sum, item) => sum + item.subtotal, 0));
    const taxes = money(items.reduce((sum, item) => sum + item.tax, 0));
    const total = money(subtotal + taxes);
    const cumulativeReturnTotal = money(priorReturns.reduce((sum, value) => sum + value.total, 0) + total);
    const folio = await nextFolio(session);
    const values = { folio, sale: sale._id, customer: sale.customer, items, reason, notes,
      status: 'processed', subtotal, taxes, total, createdBy: userId, processedAt: new Date() };
    const [created] = await SalesReturn.create([values], { session });

    for (const item of items) await inventoryService.restoreForSalesReturn({ productId: item.product, warehouseId: item.warehouse,
      quantity: item.quantity, saleId: sale._id, saleFolio: sale.folio, returnId: created._id, returnFolio: folio, userId, session });
    const receivable = await financeService.applySalesReturn({ sale, returnAmount: total, cumulativeReturnTotal, userId, session });
    const auditAfter = { saleId: String(sale._id), returnId: String(created._id), folio, items: items.map(item => ({ saleLineIndex: item.saleLineIndex, productId: String(item.product), warehouseId: String(item.warehouse), quantity: item.quantity })), total };
    await recordAudit({ userId, action: 'sales.return.created', module: 'sales', recordId: created.id, after: auditAfter, session });
    await notifyPermission('sales.returns.read', {
      type: 'sales.return.processed', title: 'Devolución procesada',
      message: `La devolución ${folio} de la venta ${sale.folio} fue procesada.`, module: 'sales', recordId: created.id,
      priority: 'normal', metadata: { saleId: String(sale._id), saleFolio: sale.folio, returnFolio: folio, total }
    }, { session });
    return { ...serialize(created.toObject()), receivableBalance: receivable.balance };
  });
}

function pageOptions(query = {}) {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(query.limit) || 25)));
  return { page, limit, skip: (page - 1) * limit };
}

async function listSalesReturns(query = {}) {
  const { page, limit, skip } = pageOptions(query);
  const filter = { status: 'processed' };
  if (query.saleId) filter.sale = objectId(query.saleId, 'saleId');
  if (query.customerId) filter.customer = objectId(query.customerId, 'customerId');
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) { const date = new Date(query.from); if (!Number.isFinite(date.getTime())) throw salesError(400, 'VALIDATION_ERROR', 'La fecha inicial no es válida'); filter.createdAt.$gte = date; }
    if (query.to) { const date = new Date(query.to); if (!Number.isFinite(date.getTime())) throw salesError(400, 'VALIDATION_ERROR', 'La fecha final no es válida'); filter.createdAt.$lte = date; }
    if (filter.createdAt.$gte && filter.createdAt.$lte && filter.createdAt.$gte > filter.createdAt.$lte) throw salesError(400, 'VALIDATION_ERROR', 'El rango de fechas no es válido');
  }
  const search = String(query.search || '').trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (search) {
    const sales = await Sale.find({ folio: { $regex: search, $options: 'i' } }).select('_id').limit(1000).lean();
    const customers = await Client.find({ name: { $regex: search, $options: 'i' } }).select('_id').limit(1000).lean();
    filter.$or = [{ folio: { $regex: search, $options: 'i' } }, { sale: { $in: sales.map(value => value._id) } }, { customer: { $in: customers.map(value => value._id) } }];
  }
  const sortField = ['folio', 'total', 'createdAt', 'status'].includes(query.sort) ? query.sort : 'createdAt';
  const direction = query.order === 'asc' ? 1 : -1;
  const [items, total] = await Promise.all([
    populate(SalesReturn.find(filter).sort({ [sortField]: direction, _id: direction }).skip(skip).limit(limit).lean()),
    SalesReturn.countDocuments(filter)
  ]);
  return { items: items.map(serialize), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function getSalesReturnById(id) {
  if (!mongoose.isValidObjectId(id)) throw salesError(400, 'INVALID_IDENTIFIER', 'Identificador inválido');
  const item = await populate(SalesReturn.findById(id).lean());
  return item ? serialize(item) : null;
}

module.exports = { createSalesReturn, listSalesReturns, getSalesReturnById, buildReturnItems, serialize };
