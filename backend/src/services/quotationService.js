const mongoose = require('mongoose');
const Quotation = require('../models/Quotation');
const Sequence = require('../models/Sequence');
const { Client } = require('../models/catalog');
const salesService = require('./salesService');
const { recordAudit } = require('./auditService');

const MAX_PAGE_SIZE = 100;
const STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'converted', 'cancelled'];

function quotationError(statusCode, errorCode, message) {
  return Object.assign(new Error(message), { statusCode, errorCode });
}

function money(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }

function serializeQuotation(quotation) {
  const customer = quotation.customerId && typeof quotation.customerId === 'object' && 'name' in quotation.customerId ? quotation.customerId : null;
  const createdBy = quotation.createdBy && typeof quotation.createdBy === 'object' && 'name' in quotation.createdBy ? quotation.createdBy : null;
  return {
    id: String(quotation._id), folio: quotation.folio,
    customerId: String(customer?._id || quotation.customerId),
    customer: customer ? { id: String(customer._id), name: customer.name, email: customer.email } : { id: String(quotation.customerId) },
    items: (quotation.items || []).map(item => {
      const product = item.product && typeof item.product === 'object' && 'name' in item.product ? item.product : null;
      const warehouse = item.warehouse && typeof item.warehouse === 'object' && 'name' in item.warehouse ? item.warehouse : null;
      return {
        productId: String(product?._id || item.product),
        product: product ? { id: String(product._id), code: product.code, name: product.name } : null,
        warehouseId: String(warehouse?._id || item.warehouse),
        warehouse: warehouse ? { id: String(warehouse._id), name: warehouse.name } : null,
        productNameSnapshot: item.productNameSnapshot, skuSnapshot: item.skuSnapshot,
        quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate,
        subtotal: item.subtotal, tax: item.tax, total: item.total
      };
    }),
    subtotal: quotation.subtotal, taxes: quotation.taxes, total: quotation.total,
    status: quotation.status, createdBy: createdBy ? { id: String(createdBy._id), name: createdBy.name } : String(quotation.createdBy),
    sentAt: quotation.sentAt, acceptedAt: quotation.acceptedAt, rejectedAt: quotation.rejectedAt,
    convertedAt: quotation.convertedAt, cancelledAt: quotation.cancelledAt,
    saleId: quotation.saleId ? String(quotation.saleId) : null,
    createdAt: quotation.createdAt, updatedAt: quotation.updatedAt
  };
}

function populateQuotation(query) {
  return query.populate('customerId', 'name email').populate('createdBy', 'name')
    .populate('items.product', 'code name status').populate('items.warehouse', 'name status');
}

function pageOptions(query = {}) {
  const pageValue = Number(query.page);
  const page = Number.isFinite(pageValue) && pageValue >= 1 ? Math.floor(pageValue) : 1;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(query.limit) || 25)));
  return { page, limit, skip: (page - 1) * limit };
}

function escapeRegex(value) { return String(value || '').trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function listQuotations(query = {}) {
  const { page, limit, skip } = pageOptions(query);
  const filter = {};
  if (query.status) {
    if (!STATUSES.includes(query.status)) throw quotationError(400, 'VALIDATION_ERROR', 'El estado de cotización no es válido');
    filter.status = query.status;
  }
  const search = escapeRegex(query.search);
  if (search) {
    const clients = await Client.find({ name: { $regex: search, $options: 'i' } }).select('_id').limit(1000).lean();
    filter.$or = [{ folio: { $regex: search, $options: 'i' } }, { customerId: { $in: clients.map(client => client._id) } }];
  }
  const sortField = ['folio', 'total', 'createdAt', 'status'].includes(query.sort) ? query.sort : 'createdAt';
  const direction = query.order === 'asc' ? 1 : -1;
  const [quotations, total] = await Promise.all([
    populateQuotation(Quotation.find(filter).sort({ [sortField]: direction, _id: direction }).skip(skip).limit(limit).lean()),
    Quotation.countDocuments(filter)
  ]);
  return { items: quotations.map(serializeQuotation), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function getQuotationById(id) {
  const quotationId = salesService.objectId(id, 'id');
  const quotation = await populateQuotation(Quotation.findById(quotationId).lean());
  return quotation ? serializeQuotation(quotation) : null;
}

async function nextQuotationFolio(session) {
  const year = new Date().getUTCFullYear();
  const sequence = await Sequence.findOneAndUpdate({ _id: `quotation:${year}` }, { $inc: { value: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session });
  return `COT-${year}-${String(sequence.value).padStart(6, '0')}`;
}

async function createQuotation(data, actorId) {
  const customerId = salesService.objectId(data?.customerId, 'customerId');
  const userId = salesService.objectId(actorId, 'usuario');
  return salesService.runTransaction(async session => {
    const customer = await salesService.validateCustomer(customerId, session);
    const items = await salesService.calculateItems(data.items, session);
    const totals = salesService.totals(items);
    const values = {
      folio: await nextQuotationFolio(session), customerId: customer._id, items, ...totals,
      status: 'draft', createdBy: userId
    };
    const [quotation] = await Quotation.create([values], { session });
    await recordAudit({ userId, action: 'quotation.create', module: 'sales', recordId: quotation.id, after: quotation, session });
    return serializeQuotation(quotation);
  });
}

async function updateQuotation(id, data, actorId) {
  const quotationId = salesService.objectId(id, 'id');
  const userId = salesService.objectId(actorId, 'usuario');
  return salesService.runTransaction(async session => {
    const quotation = await Quotation.findById(quotationId).session(session);
    if (!quotation) return null;
    if (quotation.status !== 'draft') throw quotationError(409, 'INVALID_QUOTATION_TRANSITION', 'Solo se pueden editar cotizaciones en borrador');
    const before = quotation.toObject();
    if (data.customerId !== undefined) {
      const customer = await salesService.validateCustomer(salesService.objectId(data.customerId, 'customerId'), session);
      quotation.customerId = customer._id;
    }
    if (data.items !== undefined) quotation.items = await salesService.calculateItems(data.items, session);
    const totals = salesService.totals(quotation.items);
    quotation.subtotal = totals.subtotal;
    quotation.taxes = totals.taxes;
    quotation.total = totals.total;
    await quotation.save({ session });
    await recordAudit({ userId, action: 'quotation.update', module: 'sales', recordId: quotation.id, before, after: quotation, session });
    return serializeQuotation(quotation);
  });
}

const transitions = {
  send: { from: 'draft', to: 'sent', date: 'sentAt' },
  accept: { from: 'sent', to: 'accepted', date: 'acceptedAt' },
  reject: { from: 'sent', to: 'rejected', date: 'rejectedAt' },
  cancel: { from: 'draft', to: 'cancelled', date: 'cancelledAt' }
};

async function transitionQuotation(id, action, actorId) {
  const transition = transitions[action];
  if (!transition) throw quotationError(400, 'VALIDATION_ERROR', 'La transición de cotización no es válida');
  const quotationId = salesService.objectId(id, 'id');
  const userId = salesService.objectId(actorId, 'usuario');
  return salesService.runTransaction(async session => {
    const quotation = await Quotation.findById(quotationId).session(session);
    if (!quotation) return null;
    if (quotation.status !== transition.from) throw quotationError(409, 'INVALID_QUOTATION_TRANSITION', `No se puede ${action === 'send' ? 'enviar' : action === 'accept' ? 'aceptar' : action === 'reject' ? 'rechazar' : 'cancelar'} una cotización en estado ${quotation.status}`);
    const before = quotation.toObject();
    quotation.status = transition.to;
    quotation[transition.date] = new Date();
    await quotation.save({ session });
    await recordAudit({ userId, action: `quotation.${action}`, module: 'sales', recordId: quotation.id, before, after: quotation, session });
    return serializeQuotation(quotation);
  });
}

async function convertQuotation(id, actorId) {
  const quotationId = salesService.objectId(id, 'id');
  const userId = salesService.objectId(actorId, 'usuario');
  return salesService.runTransaction(async session => {
    const quotation = await Quotation.findById(quotationId).session(session);
    if (!quotation) return null;
    if (quotation.status !== 'accepted' || quotation.saleId) {
      throw quotationError(409, 'INVALID_QUOTATION_TRANSITION', quotation.status === 'converted' ? 'La cotización ya fue convertida' : 'Solo se pueden convertir cotizaciones aceptadas');
    }
    const before = quotation.toObject();
    const sale = await salesService.createSaleInSession({
      customerId: String(quotation.customerId),
      items: quotation.items.map(item => ({
        productId: String(item.product), warehouseId: String(item.warehouse), quantity: item.quantity,
        unitPrice: item.unitPrice, taxRate: item.taxRate
      }))
    }, userId, session, { snapshotItems: quotation.items });
    quotation.status = 'converted';
    quotation.convertedAt = new Date();
    quotation.saleId = salesService.objectId(sale.id, 'saleId');
    await quotation.save({ session });
    await recordAudit({ userId, action: 'quotation.convert', module: 'sales', recordId: quotation.id, before, after: quotation, session });
    return { quotation: serializeQuotation(quotation), sale };
  });
}

module.exports = { listQuotations, getQuotationById, createQuotation, updateQuotation, transitionQuotation, convertQuotation, serializeQuotation };
