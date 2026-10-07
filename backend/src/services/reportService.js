const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const SalesReturn = require('../models/SalesReturn');
const Purchase = require('../models/Purchase');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const AccountsReceivable = require('../models/AccountsReceivable');
const AccountsPayable = require('../models/AccountsPayable');
const FinancialMovement = require('../models/FinancialMovement');
const { Client, Supplier, Product, Warehouse } = require('../models/catalog');
const { recordAudit } = require('./auditService');

const MAX_PAGE_LIMIT = 100;
const MAX_EXPORT_LIMIT = 10000;
const REPORTS = {
  sales: { model: Sale, date: 'createdAt', owner: 'customer', ownerFilter: 'customer', product: 'items.product', populate: [['customer', 'name'], ['items.product', 'name code'], ['items.warehouse', 'name'], ['createdBy', 'name'] ], totals: ['subtotal', 'taxes', 'total'] },
  'sales-returns': { model: SalesReturn, date: 'processedAt', owner: 'customer', ownerFilter: 'customer', populate: [['sale', 'folio'], ['customer', 'name'], ['createdBy', 'name']], totals: ['subtotal', 'taxes', 'total'] },
  purchases: { model: Purchase, date: 'createdAt', owner: 'supplier', ownerFilter: 'supplier', product: 'items.product', populate: [['supplier', 'name'], ['items.product', 'name code'], ['items.warehouse', 'name'], ['createdBy', 'name']], totals: ['subtotal', 'taxes', 'total'] },
  'inventory-stock': { model: InventoryStock, date: 'updatedAt', populate: [['productId', 'name code minStock'], ['warehouseId', 'name']], totals: ['quantity', 'reservedQuantity'] },
  'inventory-movements': { model: InventoryMovement, date: 'createdAt', populate: [['productId', 'name code'], ['warehouseId', 'name'], ['userId', 'name']], totals: ['quantity'] },
  receivables: { model: AccountsReceivable, date: 'createdAt', owner: 'customer', ownerFilter: 'customer', populate: [['customer', 'name'], ['sale', 'folio'], ['createdBy', 'name']], totals: ['originalAmount', 'paidAmount', 'balance'] },
  payables: { model: AccountsPayable, date: 'createdAt', owner: 'supplier', ownerFilter: 'supplier', populate: [['supplier', 'name'], ['purchase', 'folio'], ['createdBy', 'name']], totals: ['originalAmount', 'paidAmount', 'balance'] },
  'finance-movements': { model: FinancialMovement, date: 'createdAt', populate: [['createdBy', 'name'], ['referenceId', 'folio'], ['accountId', 'folio']], totals: ['amount'] }
};
const CSV_COLUMNS = {
  sales: ['folio', 'status', 'customer', 'items', 'grossSubtotal', 'grossTaxes', 'grossTotal', 'returnedSubtotal', 'returnedTaxes', 'returnedTotal', 'netSubtotal', 'netTaxes', 'netTotal', 'confirmedAt', 'createdAt'],
  'sales-returns': ['folio', 'sale', 'customer', 'processedAt', 'reason', 'subtotal', 'taxes', 'total'],
  purchases: ['folio', 'status', 'supplier', 'items', 'subtotal', 'taxes', 'total', 'receivedAt', 'createdAt'],
  'inventory-stock': ['productId', 'warehouseId', 'quantity', 'reservedQuantity', 'minimumStock', 'updatedAt'],
  'inventory-movements': ['productId', 'warehouseId', 'type', 'quantity', 'previousQuantity', 'newQuantity', 'reason', 'referenceType', 'referenceId', 'userId', 'createdAt'],
  receivables: ['folio', 'customer', 'originalAmount', 'paidAmount', 'balance', 'status', 'dueDate', 'createdAt'],
  payables: ['folio', 'supplier', 'originalAmount', 'paidAmount', 'balance', 'status', 'dueDate', 'createdAt'],
  'finance-movements': ['type', 'direction', 'amount', 'referenceType', 'referenceId', 'description', 'paymentMethod', 'createdBy', 'createdAt']
};
const CSV_HEADERS = { folio: 'Folio', status: 'Estado', customer: 'Cliente', supplier: 'Proveedor', sale: 'Folio de venta', items: 'Productos', subtotal: 'Subtotal', taxes: 'Impuestos', total: 'Total', grossSubtotal: 'Subtotal bruto', grossTaxes: 'Impuestos brutos', grossTotal: 'Total bruto', returnedSubtotal: 'Subtotal devuelto', returnedTaxes: 'Impuestos devueltos', returnedTotal: 'Total devuelto', netSubtotal: 'Subtotal neto', netTaxes: 'Impuestos netos', netTotal: 'Total neto', confirmedAt: 'Confirmada en', processedAt: 'Fecha de devolución', receivedAt: 'Recibida en', createdAt: 'Creado en', productId: 'Producto', warehouseId: 'Almacén', quantity: 'Existencia', reservedQuantity: 'Reservado', minimumStock: 'Mínimo', updatedAt: 'Actualizado en', type: 'Tipo', direction: 'Dirección', previousQuantity: 'Existencia anterior', newQuantity: 'Existencia nueva', reason: 'Motivo', referenceType: 'Tipo de referencia', referenceId: 'Referencia', userId: 'Usuario', originalAmount: 'Monto original', paidAmount: 'Monto pagado', balance: 'Saldo', dueDate: 'Vence en', amount: 'Monto', description: 'Descripción', paymentMethod: 'Método de pago', createdBy: 'Registrado por' };
const RETURN_CSV_HEADERS = { subtotal: 'Subtotal devuelto', taxes: 'Impuestos devueltos', total: 'Total devuelto' };

function reportError(statusCode, errorCode, message) { return Object.assign(new Error(message), { statusCode, errorCode }); }
function parseDate(value, field) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(String(value))) throw reportError(400, 'VALIDATION_ERROR', `${field} no es una fecha válida`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value)) && date.toISOString().slice(0, 10) !== value) throw reportError(400, 'VALIDATION_ERROR', `${field} no es una fecha válida`);
  return date;
}
function pagination(query, maxLimit = MAX_PAGE_LIMIT) {
  const pageValue = query.page === undefined ? 1 : Number(query.page);
  const limitValue = query.limit === undefined ? 25 : Number(query.limit);
  if (!Number.isInteger(pageValue) || pageValue < 1 || !Number.isInteger(limitValue) || limitValue < 1) throw reportError(400, 'VALIDATION_ERROR', 'La página y el límite deben ser enteros positivos');
  return { page: pageValue, limit: Math.min(limitValue, maxLimit), skip: (pageValue - 1) * Math.min(limitValue, maxLimit) };
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
  if (type === 'sales-returns') filter.status = 'processed';
  if (definition.ownerFilter) {
    const customerReport = ['sales', 'sales-returns', 'receivables'].includes(type);
    const partyValue = customerReport ? (query.customerId || query.customer) : query.supplier;
    if (partyValue) {
      const ids = type === 'sales-returns' && query.customerId
        ? [mongoose.isValidObjectId(query.customerId) ? new mongoose.Types.ObjectId(query.customerId) : null].filter(Boolean)
        : await resolveEntityIds(customerReport ? Client : Supplier, partyValue, customerReport ? 'customer' : 'supplier');
      if (type === 'sales-returns' && query.customerId && !ids.length) throw reportError(400, 'VALIDATION_ERROR', 'customerId no es válido');
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
  if (type === 'sales-returns' && query.saleId) {
    if (!mongoose.isValidObjectId(query.saleId)) throw reportError(400, 'VALIDATION_ERROR', 'saleId no es válido');
    filter.sale = new mongoose.Types.ObjectId(query.saleId);
  } else if (query.saleId && type !== 'sales-returns') {
    throw reportError(400, 'UNSUPPORTED_FILTER', 'El filtro de venta solo aplica al reporte de devoluciones');
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
      if (!['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'SALE', 'PURCHASE', 'RETURN', 'SALE_RETURN'].includes(query.movementType)) throw reportError(400, 'VALIDATION_ERROR', 'El tipo de movimiento no es válido');
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
        : type === 'sales-returns' ? ['folio', 'reason', 'notes', 'items.productNameSnapshot', 'items.skuSnapshot']
        : type === 'purchases' ? ['folio', 'items.productNameSnapshot', 'items.skuSnapshot']
          : type === 'inventory-stock' ? []
              : type === 'inventory-movements' ? ['reason', 'type']
              : type === 'receivables' || type === 'payables' ? ['folio']
                : ['description', 'type', 'referenceType'];
      if (!fields.length) throw reportError(400, 'UNSUPPORTED_FILTER', 'La búsqueda no aplica a este reporte');
      filter.$or = fields.map(field => ({ [field]: pattern }));
      if (type === 'sales-returns') {
        const [saleIds, customerIds] = await Promise.all([
          Sale.find({ folio: pattern }).select('_id').limit(100).lean(),
          Client.find({ name: pattern }).select('_id').limit(100).lean()
        ]);
        filter.$or.push(...(saleIds.length ? [{ sale: { $in: saleIds.map(item => item._id) } }] : []));
        filter.$or.push(...(customerIds.length ? [{ customer: { $in: customerIds.map(item => item._id) } }] : []));
      }
    }
  }
  const sortFields = ['createdAt', 'updatedAt', 'confirmedAt', 'receivedAt', 'processedAt', 'total', 'balance', 'quantity', 'amount', 'folio'];
  const sortBy = query.sortBy || definition.date;
  if (!sortFields.includes(sortBy)) throw reportError(400, 'VALIDATION_ERROR', 'El campo de ordenamiento no es válido');
  const direction = query.sortOrder || 'desc';
  if (!['asc', 'desc'].includes(direction)) throw reportError(400, 'VALIDATION_ERROR', 'El orden debe ser asc o desc');
  return { filter, sort: { [sortBy]: direction === 'asc' ? 1 : -1, _id: direction === 'asc' ? 1 : -1 }, definition };
}

function money(value) { return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100; }

function prefixSaleFilter(filter) {
  const result = { status: 'confirmed' };
  for (const [key, value] of Object.entries(filter)) {
    if (key === 'createdAt') continue;
    if (key === 'status') result.status = value;
    else if (key === '$or') {
      result.$or = value.map(clause => Object.fromEntries(Object.entries(clause).map(([field, condition]) => [`saleDoc.${field}`, condition])));
    } else result[`saleDoc.${key}`] = value;
  }
  return result;
}

function salePeriod(filter) {
  const date = filter.createdAt;
  return date ? { processedAt: date } : {};
}

async function salesReport({ filter, sort, page, limit, skip }) {
  const [sales, total, grossResult] = await Promise.all([
    Sale.find(filter).sort(sort).skip(skip).limit(limit).populate('customer', 'name').populate('items.product', 'name code').populate('items.warehouse', 'name').populate('createdBy', 'name').lean(),
    Sale.countDocuments(filter),
    Sale.aggregate([{ $match: filter }, { $group: { _id: null,
      grossSubtotal: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, '$subtotal', 0] } },
      grossTaxes: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, '$taxes', 0] } },
      grossTotal: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, '$total', 0] } }
    } }])
  ]);
  const period = salePeriod(filter);
  const saleIds = sales.map(item => item._id);
  const parentFilter = prefixSaleFilter(filter);
  const canSummarizeReturns = !filter.status || filter.status === 'confirmed';
  const [pageReturns, periodReturns] = await Promise.all([
    saleIds.length ? SalesReturn.aggregate([
      { $match: { status: 'processed', sale: { $in: saleIds }, ...period } },
      { $group: { _id: '$sale', subtotal: { $sum: '$subtotal' }, taxes: { $sum: '$taxes' }, total: { $sum: '$total' } } }
    ]) : [],
    canSummarizeReturns ? SalesReturn.aggregate([
      { $match: { status: 'processed', ...period } },
      { $lookup: { from: Sale.collection.name, localField: 'sale', foreignField: '_id', as: 'saleDoc' } },
      { $unwind: '$saleDoc' },
      { $match: parentFilter },
      { $group: { _id: null, returnsSubtotal: { $sum: '$subtotal' }, returnsTaxes: { $sum: '$taxes' }, returnsTotal: { $sum: '$total' } } }
    ]) : []
  ]);
  const pageReturnBySale = new Map(pageReturns.map(item => [String(item._id), item]));
  const items = sales.map(item => {
    const returned = pageReturnBySale.get(String(item._id)) || {};
    const confirmed = item.status === 'confirmed';
    const grossSubtotal = confirmed ? money(item.subtotal) : 0;
    const grossTaxes = confirmed ? money(item.taxes) : 0;
    const grossTotal = confirmed ? money(item.total) : 0;
    const returnedSubtotal = money(returned.subtotal);
    const returnedTaxes = money(returned.taxes);
    const returnedTotal = money(returned.total);
    return { ...item, id: String(item._id), grossSubtotal, grossTaxes, grossTotal, returnedSubtotal, returnedTaxes, returnedTotal,
      netSubtotal: money(grossSubtotal - returnedSubtotal), netTaxes: money(grossTaxes - returnedTaxes), netTotal: money(grossTotal - returnedTotal) };
  });
  const gross = grossResult[0] || {};
  const returned = periodReturns[0] || {};
  const grossSubtotal = money(gross.grossSubtotal);
  const grossTaxes = money(gross.grossTaxes);
  const grossTotal = money(gross.grossTotal);
  const returnsSubtotal = money(returned.returnsSubtotal);
  const returnsTaxes = money(returned.returnsTaxes);
  const returnsTotal = money(returned.returnsTotal);
  return {
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    totals: { recordCount: total, grossSubtotal, grossTaxes, grossTotal, returnsSubtotal, returnsTaxes, returnsTotal,
      netSubtotal: money(grossSubtotal - returnsSubtotal), netTaxes: money(grossTaxes - returnsTaxes), netTotal: money(grossTotal - returnsTotal) }
  };
}

async function getReport(type, query = {}, { maxLimit = MAX_PAGE_LIMIT } = {}) {
  const { page, limit, skip } = pagination(query, maxLimit);
  const { filter, sort, definition } = await buildFilter(type, query);
  if (type === 'sales') return salesReport({ filter, sort, page, limit, skip });
  let find = definition.model.find(filter).sort(sort).skip(skip).limit(limit);
  for (const [path, select] of definition.populate || []) find = find.populate(path, select);
  const group = { _id: null, ...Object.fromEntries(definition.totals.map(field => [field, { $sum: `$${field}` }])) };
  if (type === 'inventory-movements') {
    group.movementCount = { $sum: 1 };
    group.entries = { $sum: { $cond: [{ $in: ['$type', ['IN', 'TRANSFER_IN', 'PURCHASE', 'RETURN', 'SALE_RETURN']] }, '$quantity', 0] } };
    group.exits = { $sum: { $cond: [{ $in: ['$type', ['OUT', 'TRANSFER_OUT', 'SALE']] }, '$quantity', 0] } };
  }
  if (type === 'finance-movements') group.movementCount = { $sum: 1 };
  const [items, total, aggregate] = await Promise.all([
    find.lean(), definition.model.countDocuments(filter),
    definition.model.aggregate([{ $match: filter }, { $group: group }])
  ]);
  const totals = { recordCount: total, ...Object.fromEntries(definition.totals.map(field => [field, aggregate[0]?.[field] || 0])) };
  for (const field of ['movementCount', 'entries', 'exits']) if (aggregate[0]?.[field] !== undefined) totals[field] = aggregate[0][field];
  if (type === 'sales-returns') {
    totals.returnsSubtotal = totals.subtotal;
    totals.returnsTaxes = totals.taxes;
    totals.returnsTotal = totals.total;
    delete totals.subtotal; delete totals.taxes; delete totals.total;
  }
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
  const { items, pagination: page, totals } = await getReport(type, { ...query, page: 1, limit: MAX_EXPORT_LIMIT }, { maxLimit: MAX_EXPORT_LIMIT });
  if (page.total > MAX_EXPORT_LIMIT) throw reportError(413, 'REPORT_EXPORT_LIMIT', `El CSV supera el límite de ${MAX_EXPORT_LIMIT} registros; refine los filtros`);
  const rows = items.map(flattenItem);
  const columns = CSV_COLUMNS[type];
  const csv = [columns.map(column => csvCell((type === 'sales-returns' && RETURN_CSV_HEADERS[column]) || CSV_HEADERS[column] || column)).join(','), ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))].join('\r\n');
  await recordAudit({ userId, action: 'report.exported', module: 'reports', recordId: type, after: { filters: query, total: page.total, totals } });
  return { csv: `\uFEFF${csv}`, filename: `${type}-${new Date().toISOString().slice(0, 10)}.csv` };
}

module.exports = { getReport, exportReport, buildFilter, csvCell, REPORTS, pagination, MAX_PAGE_LIMIT, MAX_EXPORT_LIMIT, prefixSaleFilter, salesReport };
