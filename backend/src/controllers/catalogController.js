const service = require('../services/catalogService');
const { successResponse } = require('../utils/response');

function handlers(entity, label) {
  return {
    async list(req, res, next) {
      try {
        const result = await service.list(entity, req.query);
        return res.status(200).json({ success: true, message: `${label} consultados correctamente`, data: result.items, pagination: result.pagination });
      } catch (error) { return next(error); }
    },
    async create(req, res, next) {
      try { return successResponse(res, 201, `${label.slice(0, -1)} creado correctamente`, await service.create(entity, req.body, req.user.id)); }
      catch (error) { return next(error); }
    },
    async get(req, res, next) {
      try {
        const item = await service.getById(entity, req.params.id);
        return item ? successResponse(res, 200, 'Registro consultado correctamente', item) : res.status(404).json({ success: false, message: 'Registro no encontrado', error: 'RECORD_NOT_FOUND' });
      } catch (error) { return next(error); }
    },
    async update(req, res, next) {
      try {
        const item = await service.update(entity, req.params.id, req.body, req.user.id);
        return item ? successResponse(res, 200, 'Registro actualizado correctamente', item) : res.status(404).json({ success: false, message: 'Registro no encontrado', error: 'RECORD_NOT_FOUND' });
      } catch (error) { return next(error); }
    },
    async remove(req, res, next) {
      try {
        const item = await service.update(entity, req.params.id, { status: 'inactive' }, req.user.id, 'delete');
        return item ? successResponse(res, 200, 'Registro desactivado correctamente', item) : res.status(404).json({ success: false, message: 'Registro no encontrado', error: 'RECORD_NOT_FOUND' });
      } catch (error) { return next(error); }
    }
  };
}
const categories = handlers('categories', 'Categorías');
const products = handlers('products', 'Productos');
const clients = handlers('clients', 'Clientes');
const suppliers = handlers('suppliers', 'Proveedores');
const warehouses = handlers('warehouses', 'Almacenes');
module.exports = {
  getCategories: categories.list, getCategory: categories.get, updateCategory: categories.update, deleteCategory: categories.remove, createCategoryController: categories.create,
  getProducts: products.list, getProduct: products.get, updateProduct: products.update, deleteProduct: products.remove, createProductController: products.create,
  getClients: clients.list, getClient: clients.get, updateClient: clients.update, deleteClient: clients.remove, createClientController: clients.create,
  getSuppliers: suppliers.list, getSupplier: suppliers.get, updateSupplier: suppliers.update, deleteSupplier: suppliers.remove, createSupplierController: suppliers.create,
  getWarehouses: warehouses.list, getWarehouse: warehouses.get, updateWarehouse: warehouses.update, deleteWarehouse: warehouses.remove, createWarehouseController: warehouses.create
};
