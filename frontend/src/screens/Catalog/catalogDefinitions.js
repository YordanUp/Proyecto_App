export const catalogDefinitions = {
  products: {
    label: 'Productos', singular: 'producto',
    endpoint: '/api/products',
    read: 'products.read', create: 'products.create', update: 'products.update', remove: 'products.delete',
    fields: [
      { name: 'code', label: 'Código / SKU', required: true, maxLength: 64, uppercase: true },
      { name: 'name', label: 'Nombre', required: true, maxLength: 160 },
      { name: 'categoryId', label: 'Categoría', required: true, type: 'category' },
      { name: 'purchasePrice', label: 'Precio de compra', required: true, type: 'number', min: 0, step: '0.01' },
      { name: 'salePrice', label: 'Precio de venta', required: true, type: 'number', min: 0, step: '0.01' },
      { name: 'description', label: 'Descripción', type: 'textarea', maxLength: 1000 },
      { name: 'minStock', label: 'Stock mínimo', type: 'number', min: 0, step: '1' },
      { name: 'status', label: 'Estado', type: 'status' }
    ],
    columns: [
      { key: 'code', label: 'Código' }, { key: 'name', label: 'Nombre' }, { key: 'categoryId', label: 'Categoría' },
      { key: 'purchasePrice', label: 'Compra', format: 'money' }, { key: 'salePrice', label: 'Venta', format: 'money' },
      { key: 'minStock', label: 'Stock mínimo' }, { key: 'status', label: 'Estado', format: 'status' }
    ]
  },
  clients: {
    label: 'Clientes', singular: 'cliente', endpoint: '/api/clients',
    read: 'clients.read', create: 'clients.create', update: 'clients.update', remove: 'clients.delete',
    fields: [
      { name: 'name', label: 'Nombre', required: true, maxLength: 160 },
      { name: 'email', label: 'Correo', type: 'email', maxLength: 254 },
      { name: 'phone', label: 'Teléfono', maxLength: 40 },
      { name: 'status', label: 'Estado', type: 'status' }
    ],
    columns: [{ key: 'name', label: 'Nombre' }, { key: 'email', label: 'Correo' }, { key: 'phone', label: 'Teléfono' }, { key: 'status', label: 'Estado', format: 'status' }]
  },
  suppliers: {
    label: 'Proveedores', singular: 'proveedor', endpoint: '/api/suppliers',
    read: 'suppliers.read', create: 'suppliers.create', update: 'suppliers.update', remove: 'suppliers.delete',
    fields: [
      { name: 'name', label: 'Nombre', required: true, maxLength: 160 },
      { name: 'email', label: 'Correo', type: 'email', maxLength: 254 },
      { name: 'phone', label: 'Teléfono', maxLength: 40 },
      { name: 'status', label: 'Estado', type: 'status' }
    ],
    columns: [{ key: 'name', label: 'Nombre' }, { key: 'email', label: 'Correo' }, { key: 'phone', label: 'Teléfono' }, { key: 'status', label: 'Estado', format: 'status' }]
  },
  categories: {
    label: 'Categorías', singular: 'categoría', endpoint: '/api/categories',
    read: 'categories.read', create: 'categories.create', update: 'categories.update', remove: 'categories.delete',
    fields: [
      { name: 'name', label: 'Nombre', required: true, maxLength: 120 },
      { name: 'description', label: 'Descripción', type: 'textarea', maxLength: 500 },
      { name: 'status', label: 'Estado', type: 'status' }
    ],
    columns: [{ key: 'name', label: 'Nombre' }, { key: 'description', label: 'Descripción' }, { key: 'status', label: 'Estado', format: 'status' }]
  },
  warehouses: {
    label: 'Almacenes', singular: 'almacén', endpoint: '/api/warehouses',
    read: 'warehouses.read', create: 'warehouses.create', update: 'warehouses.update', remove: 'warehouses.delete',
    fields: [
      { name: 'name', label: 'Nombre', required: true, maxLength: 120 },
      { name: 'address', label: 'Dirección', type: 'textarea', maxLength: 300 },
      { name: 'status', label: 'Estado', type: 'status' }
    ],
    columns: [{ key: 'name', label: 'Nombre' }, { key: 'address', label: 'Dirección' }, { key: 'status', label: 'Estado', format: 'status' }]
  }
};
