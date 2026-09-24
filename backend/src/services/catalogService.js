const mongoose = require('mongoose');
const { Category, Product, Client, Supplier, Warehouse } = require('../models/catalog');
const { recordAudit } = require('./auditService');

const definitions = {
  categories: { model: Category, searchable: ['name'], allowed: ['name', 'description', 'status'] },
  products: { model: Product, searchable: ['name', 'code'], allowed: ['code', 'name', 'description', 'categoryId', 'purchasePrice', 'salePrice', 'minStock', 'status'] },
  clients: { model: Client, searchable: ['name', 'email'], allowed: ['name', 'email', 'phone', 'status'] },
  suppliers: { model: Supplier, searchable: ['name', 'email'], allowed: ['name', 'email', 'phone', 'status'] },
  warehouses: { model: Warehouse, searchable: ['name'], allowed: ['name', 'address', 'status'] }
};
function serialize(value) {
  const object = typeof value.toObject === 'function' ? value.toObject() : value;
  return { ...object, id: String(object._id) };
}
function criteriaFor(def, query) {
  const criteria = {};
  if (query.status && ['active', 'inactive'].includes(query.status)) criteria.status = query.status;
  if (query.categoryId && def.model === Product) criteria.categoryId = query.categoryId;
  const q = String(query.search || '').trim().slice(0, 100);
  if (q) criteria.$or = def.searchable.map(field => ({ [field]: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }));
  return criteria;
}
async function list(entity, query = {}) {
  const def = definitions[entity];
  if (!def) throw new Error('Catálogo desconocido');
  const requestedPage = Number(query.page);
  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1;
  const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 25)));
  const sortField = def.allowed.includes(query.sort) ? query.sort : 'createdAt';
  const sortDirection = query.order === 'asc' ? 1 : -1;
  const filter = criteriaFor(def, query);
  const [items, total] = await Promise.all([
    def.model.find(filter).sort({ [sortField]: sortDirection, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    def.model.countDocuments(filter)
  ]);
  return { items: items.map(serialize), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
async function getById(entity, id) {
  const def = definitions[entity];
  const item = await def.model.findById(id).lean();
  return item ? serialize(item) : null;
}
async function update(entity, id, data, actorId, action = 'update') {
  const def = definitions[entity];
  const changes = Object.fromEntries(def.allowed.filter(field => data?.[field] !== undefined).map(field => [field, data[field]]));
  if (['clients', 'suppliers'].includes(entity) && changes.email === '') delete changes.email;
  if (!Object.keys(changes).length) { const e = new Error('Debe enviar al menos un campo válido'); e.statusCode = 400; e.errorCode = 'VALIDATION_ERROR'; throw e; }
  if (['clients', 'suppliers'].includes(entity) && changes.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) { const e = new Error('Correo inválido'); e.statusCode = 400; e.errorCode = 'VALIDATION_ERROR'; throw e; }
  if (entity === 'products' && changes.categoryId !== undefined) {
    const category = mongoose.isValidObjectId(changes.categoryId) ? await Category.findById(changes.categoryId) : null;
    if (!category || category.status !== 'active') { const e = new Error('Categoría no encontrada o inactiva'); e.statusCode = 400; e.errorCode = 'INVALID_CATEGORY'; throw e; }
  }
  const session = await mongoose.startSession();
  let updated = null;
  try {
    await session.withTransaction(async () => {
      const doc = await def.model.findById(id).session(session);
      if (!doc) return;
      const before = doc.toObject();
      Object.assign(doc, changes);
      await doc.save({ session });
      updated = doc;
      await recordAudit({ userId: actorId, action, module: entity, recordId: id, before, after: doc, session });
    });
  } finally { await session.endSession(); }
  return updated ? serialize(updated) : null;
}
async function create(entity, data, actorId) {
  const def = definitions[entity];
  if (!def) throw new Error('Catálogo desconocido');
  if (!data || !data.name) { const e = new Error('El nombre es requerido'); e.statusCode = 400; e.errorCode = 'VALIDATION_ERROR'; throw e; }
  if (entity === 'products') {
    if (!data.code || !data.categoryId || !mongoose.isValidObjectId(data.categoryId) || !Number.isFinite(Number(data.salePrice)) || !Number.isFinite(Number(data.purchasePrice))) {
      const e = new Error('Código, categoría y precios válidos son requeridos'); e.statusCode = 400; e.errorCode = 'VALIDATION_ERROR'; throw e;
    }
    if (Number(data.purchasePrice) < 0 || Number(data.salePrice) < Number(data.purchasePrice)) { const e = new Error('Los precios no son válidos'); e.statusCode = 400; e.errorCode = 'VALIDATION_ERROR'; throw e; }
    const category = await Category.findById(data.categoryId);
    if (!category || category.status !== 'active') { const e = new Error('Categoría no encontrada o inactiva'); e.statusCode = 400; e.errorCode = 'INVALID_CATEGORY'; throw e; }
  }
  if (['clients', 'suppliers'].includes(entity) && data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { const e = new Error('Correo inválido'); e.statusCode = 400; e.errorCode = 'VALIDATION_ERROR'; throw e; }
  const safe = Object.fromEntries(def.allowed.filter(field => data[field] !== undefined).map(field => [field, data[field]]));
  if (['clients', 'suppliers'].includes(entity) && !safe.email) delete safe.email;
  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      [created] = await def.model.create([safe], { session });
      await recordAudit({ userId: actorId, action: 'create', module: entity, recordId: created.id, after: created, session });
    });
  } finally { await session.endSession(); }
  return serialize(created);
}
module.exports = { list, getById, create, update, definitions };
