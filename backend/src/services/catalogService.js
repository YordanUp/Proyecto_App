const { seededCategories, seededProducts, seededClients, seededSuppliers } = require('../data/catalog');

const categories = seededCategories;
const products = seededProducts;
const clients = seededClients;
const suppliers = seededSuppliers;

function listCategories() {
  return categories;
}

function getCategoryById(id) {
  return categories.find((category) => category.id === id);
}

function createCategory(data) {
  if (!data.name) {
    throw new Error('El nombre de la categoría es requerido');
  }

  const category = {
    id: `c${Date.now()}`,
    name: data.name,
    description: data.description || '',
    status: data.status || 'active',
    createdAt: new Date().toISOString()
  };

  categories.push(category);
  return category;
}

function listProducts() {
  return products;
}

function getProductById(id) {
  return products.find((product) => product.id === id);
}

function createProduct(data) {
  if (!data.name || !data.code || !data.categoryId) {
    throw new Error('Nombre, código y categoría son requeridos');
  }

  if (products.some((product) => product.code === data.code)) {
    throw new Error('El código del producto ya existe');
  }

  const product = {
    id: `p${Date.now()}`,
    code: data.code,
    name: data.name,
    description: data.description || '',
    categoryId: data.categoryId,
    purchasePrice: Number(data.purchasePrice),
    salePrice: Number(data.salePrice),
    minStock: Number(data.minStock || 0),
    status: data.status || 'active',
    stock: Number(data.stock || 0),
    createdAt: new Date().toISOString()
  };

  products.push(product);
  return product;
}

function listClients() {
  return clients;
}

function getClientById(id) {
  return clients.find((client) => client.id === id);
}

function createClient(data) {
  if (!data.name || !data.email) {
    throw new Error('Nombre y email del cliente son requeridos');
  }

  const client = {
    id: `cl${Date.now()}`,
    name: data.name,
    email: data.email,
    phone: data.phone || '',
    status: data.status || 'active',
    createdAt: new Date().toISOString()
  };

  clients.push(client);
  return client;
}

function listSuppliers() {
  return suppliers;
}

function getSupplierById(id) {
  return suppliers.find((supplier) => supplier.id === id);
}

function createSupplier(data) {
  if (!data.name || !data.email) {
    throw new Error('Nombre y email del proveedor son requeridos');
  }

  const supplier = {
    id: `s${Date.now()}`,
    name: data.name,
    email: data.email,
    phone: data.phone || '',
    status: data.status || 'active',
    createdAt: new Date().toISOString()
  };

  suppliers.push(supplier);
  return supplier;
}

module.exports = {
  listCategories,
  getCategoryById,
  createCategory,
  listProducts,
  getProductById,
  createProduct,
  listClients,
  getClientById,
  createClient,
  listSuppliers,
  getSupplierById,
  createSupplier
};
