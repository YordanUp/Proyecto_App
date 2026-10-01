const catalogs = {
  products: {
    label: 'Productos', endpoint: '/api/products', permission: 'products.read',
    createPermission: 'products.create', updatePermission: 'products.update', deletePermission: 'products.delete',
    titleField: 'name', subtitleFields: ['code', 'salePrice'],
    fields: [
      { name: 'code', label: 'Código', required: true, autoCapitalize: 'characters' },
      { name: 'name', label: 'Nombre', required: true },
      { name: 'description', label: 'Descripción', multiline: true },
      { name: 'categoryId', label: 'Categoría', type: 'category', required: true },
      { name: 'purchasePrice', label: 'Precio de compra', type: 'number', required: true },
      { name: 'salePrice', label: 'Precio de venta', type: 'number', required: true },
      { name: 'minStock', label: 'Stock mínimo', type: 'number' }
    ]
  },
  clients: {
    label: 'Clientes', endpoint: '/api/clients', permission: 'clients.read',
    createPermission: 'clients.create', updatePermission: 'clients.update', deletePermission: 'clients.delete',
    titleField: 'name', subtitleFields: ['email', 'phone'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'email', label: 'Correo', type: 'email' },
      { name: 'phone', label: 'Teléfono', type: 'phone' }
    ]
  },
  suppliers: {
    label: 'Proveedores', endpoint: '/api/suppliers', permission: 'suppliers.read',
    createPermission: 'suppliers.create', updatePermission: 'suppliers.update', deletePermission: 'suppliers.delete',
    titleField: 'name', subtitleFields: ['email', 'phone'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'email', label: 'Correo', type: 'email' },
      { name: 'phone', label: 'Teléfono', type: 'phone' }
    ]
  },
  warehouses: {
    label: 'Almacenes', endpoint: '/api/warehouses', permission: 'warehouses.read',
    createPermission: 'warehouses.create', updatePermission: 'warehouses.update', deletePermission: 'warehouses.delete',
    titleField: 'name', subtitleFields: ['address'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'address', label: 'Dirección', multiline: true }
    ]
  },
  categories: {
    label: 'Categorías', endpoint: '/api/categories', permission: 'categories.read',
    createPermission: 'categories.create', updatePermission: 'categories.update', deletePermission: 'categories.delete',
    titleField: 'name', subtitleFields: ['description'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'description', label: 'Descripción', multiline: true }
    ]
  }
};

module.exports = catalogs;
