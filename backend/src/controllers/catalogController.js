const { listCategories, createCategory, listProducts, createProduct, listClients, createClient, listSuppliers, createSupplier } = require('../services/catalogService');
const { successResponse, errorResponse } = require('../utils/response');

function getCategories(req, res) {
  return successResponse(res, 200, 'Categorías consultadas', listCategories());
}

function createCategoryController(req, res) {
  try {
    const category = createCategory(req.body);
    return successResponse(res, 201, 'Categoría creada correctamente', category);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'CATEGORY_CREATE_ERROR');
  }
}

function getProducts(req, res) {
  return successResponse(res, 200, 'Productos consultados', listProducts());
}

function createProductController(req, res) {
  try {
    const product = createProduct(req.body);
    return successResponse(res, 201, 'Producto creado correctamente', product);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'PRODUCT_CREATE_ERROR');
  }
}

function getClients(req, res) {
  return successResponse(res, 200, 'Clientes consultados', listClients());
}

function createClientController(req, res) {
  try {
    const client = createClient(req.body);
    return successResponse(res, 201, 'Cliente creado correctamente', client);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'CLIENT_CREATE_ERROR');
  }
}

function getSuppliers(req, res) {
  return successResponse(res, 200, 'Proveedores consultados', listSuppliers());
}

function createSupplierController(req, res) {
  try {
    const supplier = createSupplier(req.body);
    return successResponse(res, 201, 'Proveedor creado correctamente', supplier);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'SUPPLIER_CREATE_ERROR');
  }
}

module.exports = {
  getCategories,
  createCategoryController,
  getProducts,
  createProductController,
  getClients,
  createClientController,
  getSuppliers,
  createSupplierController
};
