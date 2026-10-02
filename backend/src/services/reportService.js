const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const AccountsReceivable = require('../models/AccountsReceivable');
const AccountsPayable = require('../models/AccountsPayable');
const FinancialMovement = require('../models/FinancialMovement');
const { Client, Supplier, Product, Warehouse } = require('../models/catalog');
const { recordAudit } = require('./auditService');

const MAX_LIMIT = 100;
const REPORTS = {
  sales: { model: Sale, date: 'createdAt', owner: 'customer', ownerFilter: 'customer', product: 'items.product', populate: [['customer', 'name'], ['items.product', 'name code'], ['items.warehouse', 'name'], ['createdBy', 'name'] ], totals: ['subtotal', 'taxes', 'total'] },
  purchases: { model: Purchase, date: 'createdAt', owner: 'supplier', ownerFilter: 'supplier', product: 'items.product', populate: [['supplier', 'name'], ['items.product', 'name code'], ['items.warehouse', 'name'], ['createdBy', 'name']], totals: ['subtotal', 'taxes', 'total'] },
  'inventory-stock': { model: InventoryStock, date: 'updatedAt', populate: [['productId', 'name code minStock'], ['warehouseId', 'name']], totals: ['quantity', 'reservedQuantity'] },
  'inventory-movements': { model: InventoryMovement, date: 'createdAt', populate: [['productId', 'name code'], ['warehouseId', 'name'], ['userId', 'name']], totals: ['quantity'] },
  receivables: { model: AccountsReceivable, date: 'createdAt', owner: 'customer', ownerFilter: 'customer', populate: [['customer', 'name'], ['sale', 'folio'], ['createdBy', 'name']], totals: ['originalAmount', 'paidAmount', 'balance'] },
  payables: { model: AccountsPayable, date: 'createdAt', owner: 'supplier', ownerFilter: 'supplier', populate: [['supplier', 'name'], ['purchase', 'folio'], ['createdBy', 'name']], totals: ['originalAmount', 'paidAmount', 'balance'] },
  'finance-movements': { model: FinancialMovement, date: 'createdAt', populate: [['createdBy', 'name'], ['referenceId', 'folio'], ['accountId', 'folio']], totals: ['amount'] }
};
const CSV_COLUMNS = {
  sales: ['folio', 'status', 'customer', 'items', 'subtotal', 'taxes', 'total', 'confirmedAt', 'createdAt'],
  purchases: ['folio', 'status', 'supplier', 'items', 'subtotal', 'taxes', 'total', 'receivedAt', 'createdAt'],
  'inventory-stock': ['productId', 'warehouseId', 'quantity', 'reservedQuantity', 'minimumStock', 'updatedAt'],
  'inventory-movements': ['productId', 'warehouseId', 'type', 'quantity', 'previousQuantity', 'newQuantity', 'reason', 'referenceType', 'referenceId', 'userId', 'createdAt'],
  receivables: ['folio', 'customer', 'originalAmount', 'paidAmount', 'balance', 'status', 'dueDate', 'createdAt'],
  payables: ['folio', 'supplier', 'originalAmount', 'paidAmount', 'balance', 'status', 'dueDate', 'createdAt'],
  'finance-movements': ['type', 'direction', 'amount', 'referenceType', 'referenceId', 'description', 'paymentMethod', 'createdBy', 'createdAt']
};
const CSV_HEADERS = { folio: 'Folio', status: 'Estado', customer: 'Cliente', supplier: 'Proveedor', items: 'Productos', subtotal: 'Subtotal', taxes: 'Impuestos', total: 'Total', confirmedAt: 'Confirmada en', receivedAt: 'Recibida en', createdAt: 'Creado en', productId: 'Producto', warehouseId: 'Almacén', quantity: 'Existencia', reservedQuantity: 'Reservado', minimumStock: 'Mínimo', updatedAt: 'Actualizado en', type: 'Tipo', direction: 'Dirección', previousQuantity: 'Existencia anterior', newQuantity: 'Existencia nueva', reason: 'Motivo', referenceType: 'Tipo de referencia', referenceId: 'Referencia', userId: 'Usuario', originalAmount: 'Monto original', paidAmount: 'Monto pagado', balance: 'Saldo', dueDate: 'Vence en', amount: 'Monto', description: 'Descripción', paymentMethod: 'Método de pago', createdBy: 'Registrado por' };

function reportError(statusCode, errorCode, message) { return Object.assign(new Error(message), { statusCode, errorCode }); }
function parseDate(value, field) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(String(value))) throw reportError(400, 'VALIDATION_ERROR', `${field} no es una fecha válida`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value)) && date.toISOString().slice(0, 10) !== value) throw reportError(400, 'VALIDATION_ERROR', `${field} no es una fecha válida`);
  return date;
}
function pagination(query) {
  const pageValue = query.page === undefined ? 1 : Number(query.page);
  const limitValue = query.limit === undefined ? 25 : Number(query.limit);
  if (!Number.isInteger(pageValue) || pageValue < 1 || !Number.isInteger(limitValue) || limitValue < 1) throw reportError(400, 'VALIDATION_ERROR', 'La página y el límite deben ser enteros positivos');
  return { page: pageValue, limit: Math.min(limitValue, MAX_LIMIT), skip: (pageValue - 1) * Math.min(limitValue, MAX_LIMIT) };
}
function escapeRegex(value) { return String(value).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
async function resolveEntityIds(Model, value, field) {
  if (mongoose.isValidObjectId(value)) return [new mongoose.Types.ObjectId(value)];
  if (String(value).length === 24) throw reportError(400, 'VALIDATION_ERROR', `${field} no es válido`);
  const pattern = escapeRegex(value);
  if (!pattern) throw reportError(400, 'VALIDATION_ERROR', `${field} no es válido`);
  const matches = await Model.find({ name: new RegExp(pattern, 'i') }).select('_id').limit(100).lean();
  return matches.map(item => item._id);
}

async function buildFilter(type, query) {
  const definition = REPORTS[type];
  if (!definition) throw reportError(400, 'INVALID_REPORT_TYPE', 'El tipo de reporte no es válido');
  if ((['sales', 'receivables'].includes(type) && query.supplier) || (['purchases', 'payables'].includes(type) && query.customer)) {
    throw reportError(400, 'UNSUPPORTED_FILTER', 'El filtro de cliente/proveedor no aplica a este reporte');
  }
  const filter = {};
  const from = parseDate(query.from || query.dateFrom, 'from');
  const to = parseDate(query.to || query.dateTo, 'to');
  if (from && to && from > to) throw reportError(400, 'INVALID_DATE_RANGE', 'La fecha inicial no puede ser posterior a la fecha final');
  if (from || to) {
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(String(query.to || query.dateTo || ''))) to.setUTCHours(23, 59, 59, 999);
    filter[definition.date] = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  }
  if (query.status) {
    if (!['sales', 'purchases', 'receivables', 'payables'].includes(type)) throw reportError(400, 'UNSUPPORTED_FILTER', 'El filtro de estado no aplica a este reporte');
    const allowed = type === 'sales' ? ['draft', 'confirmed', 'cancelled'] : type === 'purchases' ? ['draft', 'ordered', 'received', 'cancelled'] : ['pending', 'partial', 'paid', 'cancelled'];
    if (!allowed.includes(query.status)) throw reportError(400, 'VALIDATION_ERROR', 'El estado no es válido para este reporte');
    filter.status = query.status;
  }
  if (definition.ownerFilter) {
    const customerReport = type === 'sales' || type === 'receivables';
    const partyValue = customerReport ? query.customer : query.supplier;
    if (partyValue) {
      const ids = await resolveEntityIds(customerReport ? Client : Supplier, partyValue, customerReport ? 'customer' : 'supplier');
      filter[definition.ownerFilter] = { $in: ids };
    }
  } else if (query.customer || query.supplier) {
    if (type !== 'finance-movements') throw reportError(400, 'UNSUPPORTED_FILTER', 'El cliente o proveedor no aplica a este reporte');
    const customerIds = query.customer ? await resolveEntityIds(Client, query.customer, 'customer') : [];
    const supplierIds = query.supplier ? await resolveEntityIds(Supplier, query.supplier, 'supplier') : [];
    const accountIds = [
      ...(customerIds.length ? await AccountsReceivable.find({ customer: { $in: customerIds } }).distinct('_id') : []),
      ...(supplierIds.length ? await AccountsPayable.find({ supplier: { $in: supplierIds } }).distinct('_id') : [])
    ];
    filter.accountId = { $in: accountIds };
  }
  if (query.product) {
    const productIds = await resolveEntityIds(Product, query.product, 'product');
    if (definition.product) filter[definition.product] = { $in: productIds };
    else if (type === 'inventory-stock' || type === 'inventory-movements') filter.productId = { $in: productIds };
    else throw reportError(400, 'UNSUPPORTED_FILTER', 'El producto no aplica a este reporte');
  }
  if (query.warehouse) {
    const warehouseIds = await resolveEntityIds(Warehouse, query.warehouse, 'warehouse');
    if (type === 'inventory-stock' || type === 'inventory-movements') filter.warehouseId = { $in: warehouseIds };
    else if (['sales', 'purchases'].includes(type)) filter['items.warehouse'] = { $in: warehouseIds };
    else throw reportError(400, 'UNSUPPORTED_FILTER', 'El almacén no aplica a este reporte');
  }
  if (query.movementType) {
    if (type === 'inventory-movements') {
      if (!['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'SALE', 'PURCHASE', 'RETURN'].includes(query.movementType)) throw reportError(400, 'VALIDATION_ERROR', 'El tipo de movimiento no es válido');
      filter.type = query.movementType;
    } else if (type === 'finance-movements') {
      if (!['RECEIVABLE_PAYMENT', 'PAYABLE_PAYMENT'].includes(query.movementType)) throw reportError(400, 'VALIDATION_ERROR', 'El tipo de movimiento no es válido');
      filter.type = query.movementType;
    } else throw reportError(400, 'UNSUPPORTED_FILTER', 'El tipo de movimiento no aplica a este reporte');
  }
  if (type === 'inventory-stock' && query.lowStock === 'true') filter.$expr = { $lte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, '$minimumStock'] };
  if (query.search) {
    const search = String(query.search).trim().slice(0, 100);
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      const fields = type === 'sales' ? ['folio', 'items.productNameSnapshot', 'items.skuSnapshot']
        : type === 'purchases' ? ['folio', 'items.productNameSnapshot', 'items.skuSnapshot']
          : type === 'inventory-stock' ? []
              : type === 'inventory-movements' ? ['reason', 'type']
              : type === 'receivables' || type === 'payables' ? ['folio']
                : ['description', 'type', 'referenceType'];
      if (!fields.length) throw reportError(400, 'UNSUPPORTED_FILTER', 'La búsqueda no aplica a este reporte');
      filter.$or = fields.map(field => ({ [field]: pattern }));
    }
  }
  const sortFields = ['createdAt', 'updatedAt', 'confirmedAt', 'receivedAt', 'total', 'balance', 'quantity', 'amount', 'folio'];
  const sortBy = query.sortBy || definition.date;
  if (!sortFields.includes(sortBy)) throw reportError(400, 'VALIDATION_ERROR', 'El campo de ordenamiento no es válido');
  const direction = query.sortOrder || 'desc';
  if (!['asc', 'desc'].includes(direction)) throw reportError(400, 'VALIDATION_ERROR', 'El orden debe ser asc o desc');
  return { filter, sort: { [sortBy]: direction === 'asc' ? 1 : -1, _id: direction === 'asc' ? 1 : -1 }, definition };
}

async function getReport(type, query = {}) {
  const { page, limit, skip } = pagination(query);
  const { filter, sort, definition } = await buildFilter(type, query);
  let find = definition.model.find(filter).sort(sort).skip(skip).limit(limit);
  for (const [path, select] of definition.populate || []) find = find.populate(path, select);
  const group = { _id: null, ...Object.fromEntries(definition.totals.map(field => [field, { $sum: `$${field}` }])) };
  if (type === 'inventory-movements') {
    group.movementCount = { $sum: 1 };
    group.entries = { $sum: { $cond: [{ $in: ['$type', ['IN', 'TRANSFER_IN', 'PURCHASE', 'RETURN']] }, '$quantity', 0] } };
    group.exits = { $sum: { $cond: [{ $in: ['$type', ['OUT', 'TRANSFER_OUT', 'SALE']] }, '$quantity', 0] } };
  }
  if (type === 'finance-movements') group.movementCount = { $sum: 1 };
  const [items, total, aggregate] = await Promise.all([
    find.lean(), definition.model.countDocuments(filter),
    definition.model.aggregate([{ $match: filter }, { $group: group }])
  ]);
  const totals = { recordCount: total, ...Object.fromEntries(definition.totals.map(field => [field, aggregate[0]?.[field] || 0])) };
  for (const field of ['movementCount', 'entries', 'exits']) if (aggregate[0]?.[field] !== undefined) totals[field] = aggregate[0][field];
  return {
    items: items.map(item => ({ ...item, id: String(item._id) })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    totals
  };
}

function csvCell(value) {
  const numeric = typeof value === 'number';
  let text = value == null ? '' : value instanceof Date ? value.toISOString() : typeof value === 'object' ? (value.name || value.folio || value.code || value._id || JSON.stringify(value)) : String(value);
  if (!numeric && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
function flattenItem(item) {
  return Object.fromEntries(Object.entries(item).filter(([key]) => key !== '__v').map(([key, value]) => [key, value && typeof value === 'object' && !Array.isArray(value) && value._id ? (value.name || value.folio || value.code || String(value._id)) : value]));
}
async function exportReport(type, query = {}, userId) {
  const { items, pagination: page, totals } = await getReport(type, { ...query, page: 1, limit: MAX_LIMIT });
  if (page.total > MAX_LIMIT) throw reportError(413, 'REPORT_EXPORT_LIMIT', `El CSV supera el límite de ${MAX_LIMIT} registros; refine los filtros`);
  const rows = items.map(flattenItem);
  const columns = CSV_COLUMNS[type];
  const csv = [columns.map(column => csvCell(CSV_HEADERS[column] || column)).join(','), ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))].join('\r\n');
  await recordAudit({ userId, action: 'report.exported', module: 'reports', recordId: type, after: { filters: query, total: page.total, totals } });
  return { csv: `\uFEFF${csv}`, filename: `${type}-${new Date().toISOString().slice(0, 10)}.csv` };
}

module.exports = { getReport, exportReport, buildFilter, csvCell, REPORTS };
