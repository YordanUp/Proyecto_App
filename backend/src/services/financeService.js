const mongoose = require('mongoose');
const AccountsReceivable = require('../models/AccountsReceivable');
const AccountsPayable = require('../models/AccountsPayable');
const FinancialMovement = require('../models/FinancialMovement');
const Sequence = require('../models/Sequence');
const { Client, Supplier } = require('../models/catalog');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const { recordAudit } = require('./auditService');
const { notifyPermission } = require('./notificationService');

const MAX_PAGE_SIZE = 100;
const PAYMENT_METHODS = new Set(['cash', 'transfer', 'card', 'check', 'other']);

function financeError(statusCode, errorCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

function objectId(value, field = 'id') {
  if (!mongoose.isValidObjectId(value)) throw financeError(400, 'VALIDATION_ERROR', `${field} no es válido`);
  return new mongoose.Types.ObjectId(value);
}

function money(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }

function paymentAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) {
    throw financeError(400, 'INVALID_PAYMENT_AMOUNT', 'El pago debe ser mayor a cero y tener máximo dos decimales');
  }
  return money(amount);
}

function paymentMethod(value) {
  const method = String(value || 'other').trim().toLowerCase();
  if (!PAYMENT_METHODS.has(method)) throw financeError(400, 'INVALID_PAYMENT_METHOD', 'El método de pago no es válido');
  return method;
}

async function runTransaction(operation) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const session = await mongoose.startSession();
    try { return await session.withTransaction(() => operation(session)); }
    catch (error) {
      if (error.code !== 11000 || attempt === 2) throw error;
    } finally { await session.endSession(); }
  }
  throw financeError(409, 'FINANCE_CONFLICT', 'La operación financiera entró en conflicto con otra solicitud');
}

async function nextFolio(kind, session) {
  const year = new Date().getUTCFullYear();
  const counter = await Sequence.findOneAndUpdate({ _id: `${kind}:${year}` }, { $inc: { value: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session });
  const prefix = kind === 'receivable' ? 'CXC' : 'CXP';
  return `${prefix}-${year}-${String(counter.value).padStart(6, '0')}`;
}

async function createReceivableForSale({ sale, userId, session }) {
  if (!session?.inTransaction()) throw new Error('La cuenta por cobrar requiere una transacción activa');
  const existing = await AccountsReceivable.findOne({ sale: sale._id }).session(session);
  if (existing) throw financeError(409, 'RECEIVABLE_ALREADY_EXISTS', 'La venta ya tiene una cuenta por cobrar');
  const originalAmount = money(sale.total);
  const paidAt = originalAmount === 0 ? new Date() : null;
  const values = {
    folio: await nextFolio('receivable', session), sale: sale._id, customer: sale.customer,
    originalAmount, paidAmount: 0, balance: originalAmount,
    status: originalAmount === 0 ? 'paid' : 'pending', createdBy: userId, paidAt
  };
  const [account] = await AccountsReceivable.create([values], { session });
  await recordAudit({ userId, action: 'receivable.created', module: 'finance', recordId: account.id, after: values, session });
  return account;
}

async function createPayableForPurchase({ purchase, userId, session }) {
  if (!session?.inTransaction()) throw new Error('La cuenta por pagar requiere una transacción activa');
  const existing = await AccountsPayable.findOne({ purchase: purchase._id }).session(session);
  if (existing) throw financeError(409, 'PAYABLE_ALREADY_EXISTS', 'La compra ya tiene una cuenta por pagar');
  const originalAmount = money(purchase.total);
  const paidAt = originalAmount === 0 ? new Date() : null;
  const values = {
    folio: await nextFolio('payable', session), purchase: purchase._id, supplier: purchase.supplier,
    originalAmount, paidAmount: 0, balance: originalAmount,
    status: originalAmount === 0 ? 'paid' : 'pending', createdBy: userId, paidAt
  };
  const [account] = await AccountsPayable.create([values], { session });
  await recordAudit({ userId, action: 'payable.created', module: 'finance', recordId: account.id, after: values, session });
  return account;
}

function pagination(query = {}) {
  const requestedPage = Number(query.page);
  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(query.limit) || 25)));
  return { page, limit, skip: (page - 1) * limit };
}

function escapedSearch(value) { return String(value || '').trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function dateRange(query, field = 'createdAt') {
  if (!query.from && !query.to) return null;
  const range = {};
  if (query.from) { const from = new Date(query.from); if (!Number.isFinite(from.getTime())) throw financeError(400, 'VALIDATION_ERROR', 'La fecha inicial no es válida'); range.$gte = from; }
  if (query.to) {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(query.to);
    const to = new Date(query.to);
    if (!Number.isFinite(to.getTime())) throw financeError(400, 'VALIDATION_ERROR', 'La fecha final no es válida');
    if (dateOnly) to.setUTCHours(23, 59, 59, 999);
    range.$lte = to;
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte) throw financeError(400, 'VALIDATION_ERROR', 'El rango de fechas no es válido');
  return { [field]: range };
}

function statusFilter(query, allowed) {
  if (!query.status) return {};
  if (!allowed.includes(query.status)) throw financeError(400, 'VALIDATION_ERROR', 'El estado de cuenta no es válido');
  return { status: query.status };
}

function serializeAccount(account, kind) {
  const isReceivable = kind === 'receivable';
  const party = isReceivable ? account.customer : account.supplier;
  const source = isReceivable ? account.sale : account.purchase;
  const creator = account.createdBy;
  return {
    id: String(account._id), folio: account.folio,
    [isReceivable ? 'customer' : 'supplier']: party && typeof party === 'object' && 'name' in party ? { id: String(party._id), name: party.name, email: party.email } : { id: String(party) },
    [isReceivable ? 'customerId' : 'supplierId']: String(party?._id || party),
    [isReceivable ? 'sale' : 'purchase']: source && typeof source === 'object' && 'folio' in source ? { id: String(source._id), folio: source.folio } : { id: String(source) },
    originalAmount: account.originalAmount, paidAmount: account.paidAmount, balance: account.balance,
    status: account.status, dueDate: account.dueDate, paidAt: account.paidAt,
    createdBy: creator && typeof creator === 'object' && 'name' in creator ? { id: String(creator._id), name: creator.name } : String(creator),
    createdAt: account.createdAt, updatedAt: account.updatedAt
  };
}

function accountPopulation(query, kind) {
  return kind === 'receivable'
    ? query.populate('customer', 'name email').populate('sale', 'folio').populate('createdBy', 'name')
    : query.populate('supplier', 'name email').populate('purchase', 'folio').populate('createdBy', 'name');
}

async function listAccounts(kind, query = {}) {
  const isReceivable = kind === 'receivable';
  const Model = isReceivable ? AccountsReceivable : AccountsPayable;
  const Party = isReceivable ? Client : Supplier;
  const partyField = isReceivable ? 'customer' : 'supplier';
  const sourceField = isReceivable ? 'sale' : 'purchase';
  const Source = isReceivable ? Sale : Purchase;
  const { page, limit, skip } = pagination(query);
  const filter = { ...statusFilter(query, ['pending', 'partial', 'paid', 'cancelled']) };
  if (query.partyId) filter[partyField] = objectId(query.partyId, 'partyId');
  if (query.customerId && isReceivable) filter.customer = objectId(query.customerId, 'customerId');
  if (query.supplierId && !isReceivable) filter.supplier = objectId(query.supplierId, 'supplierId');
  if (query.saleId && isReceivable) filter.sale = objectId(query.saleId, 'saleId');
  if (query.purchaseId && !isReceivable) filter.purchase = objectId(query.purchaseId, 'purchaseId');
  Object.assign(filter, dateRange(query));
  const search = escapedSearch(query.search);
  if (search) {
    const [parties, sources] = await Promise.all([
      Party.find({ name: { $regex: search, $options: 'i' } }).select('_id').limit(1000).lean(),
      Source.find({ folio: { $regex: search, $options: 'i' } }).select('_id').limit(1000).lean()
    ]);
    filter.$or = [{ folio: { $regex: search, $options: 'i' } }, { [partyField]: { $in: parties.map(item => item._id) } }, { [sourceField]: { $in: sources.map(item => item._id) } }];
  }
  const sortField = ['folio', 'originalAmount', 'paidAmount', 'balance', 'createdAt', 'status'].includes(query.sort) ? query.sort : 'createdAt';
  const direction = query.order === 'asc' ? 1 : -1;
  const [accounts, total] = await Promise.all([
    accountPopulation(Model.find(filter).sort({ [sortField]: direction, _id: -1 }).skip(skip).limit(limit).lean(), kind),
    Model.countDocuments(filter)
  ]);
  return { items: accounts.map(account => serializeAccount(account, kind)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function getAccount(kind, id) {
  const Model = kind === 'receivable' ? AccountsReceivable : AccountsPayable;
  const account = await accountPopulation(Model.findById(objectId(id)).lean(), kind);
  return account ? serializeAccount(account, kind) : null;
}

function serializeMovement(movement) {
  const creator = movement.createdBy && typeof movement.createdBy === 'object' && 'name' in movement.createdBy ? movement.createdBy : null;
  const account = movement.accountId && typeof movement.accountId === 'object' && 'folio' in movement.accountId ? movement.accountId : null;
  const reference = movement.referenceId && typeof movement.referenceId === 'object' && 'folio' in movement.referenceId ? movement.referenceId : null;
  return {
    id: String(movement._id), type: movement.type, direction: movement.direction, amount: movement.amount,
    referenceType: movement.referenceType, referenceId: String(reference?._id || movement.referenceId), referenceFolio: reference?.folio || null,
    accountId: String(account?._id || movement.accountId), accountFolio: account?.folio || null,
    description: movement.description, paymentMethod: movement.paymentMethod,
    createdBy: creator ? { id: String(creator._id), name: creator.name } : String(movement.createdBy), createdAt: movement.createdAt
  };
}

async function listMovements(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = { ...dateRange(query) };
  if (query.type) {
    if (!['RECEIVABLE_PAYMENT', 'PAYABLE_PAYMENT'].includes(query.type)) throw financeError(400, 'VALIDATION_ERROR', 'El tipo de movimiento no es válido');
    filter.type = query.type;
  }
  if (query.direction) {
    if (!['IN', 'OUT'].includes(query.direction)) throw financeError(400, 'VALIDATION_ERROR', 'La dirección del movimiento no es válida');
    filter.direction = query.direction;
  }
  const search = escapedSearch(query.search);
  if (search) {
    const [customers, suppliers, sales, purchases] = await Promise.all([
      Client.find({ name: { $regex: search, $options: 'i' } }).select('_id').limit(1000).lean(),
      Supplier.find({ name: { $regex: search, $options: 'i' } }).select('_id').limit(1000).lean(),
      Sale.find({ folio: { $regex: search, $options: 'i' } }).select('_id').limit(1000).lean(),
      Purchase.find({ folio: { $regex: search, $options: 'i' } }).select('_id').limit(1000).lean()
    ]);
    const [receivableIds, payableIds] = await Promise.all([
      AccountsReceivable.find({ $or: [{ folio: { $regex: search, $options: 'i' } }, { customer: { $in: customers.map(item => item._id) } }] }).distinct('_id'),
      AccountsPayable.find({ $or: [{ folio: { $regex: search, $options: 'i' } }, { supplier: { $in: suppliers.map(item => item._id) } }] }).distinct('_id')
    ]);
    filter.$or = [
      { accountId: { $in: receivableIds } }, { accountId: { $in: payableIds } },
      { referenceId: { $in: sales.map(item => item._id) } }, { referenceId: { $in: purchases.map(item => item._id) } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  const direction = query.order === 'asc' ? 1 : -1;
  const [items, total] = await Promise.all([
    FinancialMovement.find(filter).populate('accountId', 'folio').populate('referenceId', 'folio').populate('createdBy', 'name')
      .sort({ createdAt: direction, _id: direction }).skip(skip).limit(limit).lean(),
    FinancialMovement.countDocuments(filter)
  ]);
  return { items: items.map(serializeMovement), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function recordPayment(kind, id, input, actorId) {
  const receivable = kind === 'receivable';
  const Model = receivable ? AccountsReceivable : AccountsPayable;
  const accountModel = receivable ? 'AccountsReceivable' : 'AccountsPayable';
  const sourceField = receivable ? 'sale' : 'purchase';
  const sourceModel = receivable ? 'Sale' : 'Purchase';
  const partyField = receivable ? 'customer' : 'supplier';
  const userId = objectId(actorId, 'usuario');
  const accountId = objectId(id);
  const amount = paymentAmount(input?.amount);
  const method = paymentMethod(input?.paymentMethod);
  const description = String(input?.description || (receivable ? 'Cobro de cliente' : 'Pago a proveedor')).trim();
  if (!description || description.length > 300) throw financeError(400, 'VALIDATION_ERROR', 'La descripción no es válida');

  return runTransaction(async session => {
    const account = await Model.findById(accountId).session(session);
    if (!account) throw financeError(404, 'FINANCE_ACCOUNT_NOT_FOUND', 'La cuenta financiera no existe');
    if (!['pending', 'partial'].includes(account.status)) throw financeError(409, 'ACCOUNT_NOT_PAYABLE', 'La cuenta no admite más pagos');
    if (amount > account.balance) throw financeError(409, 'PAYMENT_EXCEEDS_BALANCE', 'El pago supera el saldo pendiente');

    const paidAmount = money(account.paidAmount + amount);
    const balance = money(account.balance - amount);
    const status = balance === 0 ? 'paid' : 'partial';
    const before = { paidAmount: account.paidAmount, balance: account.balance, status: account.status };
    const updated = await Model.findOneAndUpdate({
      _id: accountId, status: { $in: ['pending', 'partial'] }, balance: { $gte: amount }, paidAmount: account.paidAmount
    }, { $set: { paidAmount, balance, status, paidAt: balance === 0 ? new Date() : null } }, { new: true, runValidators: true, session });
    if (!updated) throw financeError(409, 'PAYMENT_CONFLICT', 'El saldo cambió por otro pago; vuelve a consultar la cuenta');

    const movementValues = {
      type: receivable ? 'RECEIVABLE_PAYMENT' : 'PAYABLE_PAYMENT', direction: receivable ? 'IN' : 'OUT', amount,
      referenceType: receivable ? 'sale' : 'purchase', referenceId: account[sourceField], referenceModel: sourceModel,
      accountId: account._id, accountModel, description, paymentMethod: method, createdBy: userId
    };
    const [movement] = await FinancialMovement.create([movementValues], { session });
    await recordAudit({ userId, action: receivable ? 'receivable.payment' : 'payable.payment', module: 'finance', recordId: updated.id, before, after: updated, session });
    if (status === 'paid') await recordAudit({ userId, action: receivable ? 'receivable.paid' : 'payable.paid', module: 'finance', recordId: updated.id, before, after: updated, session });
    await recordAudit({ userId, action: 'finance.movement.created', module: 'finance', recordId: movement.id, after: movementValues, session });
    await notifyPermission('finance.read', {
      type: receivable ? 'finance.payment_received' : 'finance.payment_sent',
      title: receivable ? 'Pago recibido' : 'Pago a proveedor realizado',
      message: `${receivable ? 'Se recibió un pago de' : 'Se registró un pago a'} ${amount.toFixed(2)} para ${updated.folio}.`,
      module: 'finance', recordId: movement.id, priority: 'normal',
      metadata: { amount, accountId: String(updated._id), movementType: movementValues.type }
    }, { session });
    return { account: serializeAccount(updated, kind), movement: serializeMovement(movement) };
  });
}

async function cancelReceivableForSale({ saleId, userId, session }) {
  if (!session?.inTransaction()) throw new Error('La cancelación financiera requiere una transacción activa');
  const account = await AccountsReceivable.findOne({ sale: saleId }).session(session);
  if (!account) return null;
  if (account.paidAmount > 0) throw financeError(409, 'SALE_HAS_PAYMENTS', 'La venta tiene pagos registrados y requiere un flujo explícito de reembolso antes de cancelarse');
  if (account.status === 'cancelled') return account;
  const before = { status: account.status, paidAmount: account.paidAmount, balance: account.balance };
  account.status = 'cancelled';
  await account.save({ session });
  await recordAudit({ userId, action: 'receivable.cancelled', module: 'finance', recordId: account.id, before, after: account, session });
  return account;
}

module.exports = {
  createReceivableForSale, createPayableForPurchase, cancelReceivableForSale,
  listReceivables: query => listAccounts('receivable', query),
  getReceivable: id => getAccount('receivable', id),
  payReceivable: (id, input, actorId) => recordPayment('receivable', id, input, actorId),
  listPayables: query => listAccounts('payable', query),
  getPayable: id => getAccount('payable', id),
  payPayable: (id, input, actorId) => recordPayment('payable', id, input, actorId),
  listMovements
};
