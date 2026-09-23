const seededCategories = [
  {
    id: 'c1',
    name: 'Electrónica',
    description: 'Productos electrónicos',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'c2',
    name: 'Accesorios',
    description: 'Accesorios varios',
    status: 'active',
    createdAt: new Date().toISOString()
  }
];

const seededProducts = [
  {
    id: 'p1',
    code: 'ELE-001',
    name: 'Teclado USB',
    description: 'Teclado de oficina',
    categoryId: 'c1',
    purchasePrice: 180,
    salePrice: 260,
    minStock: 10,
    status: 'active',
    stock: 15,
    createdAt: new Date().toISOString()
  },
  {
    id: 'p2',
    code: 'ACC-001',
    name: 'Mouse Inalámbrico',
    description: 'Mouse ergonómico',
    categoryId: 'c2',
    purchasePrice: 120,
    salePrice: 190,
    minStock: 8,
    status: 'active',
    stock: 9,
    createdAt: new Date().toISOString()
  }
];

const seededClients = [
  {
    id: 'cl1',
    name: 'Distribuidora Norte',
    email: 'contacto@norte.com',
    phone: '+51 999 888 777',
    status: 'active',
    createdAt: new Date().toISOString()
  }
];

const seededSuppliers = [
  {
    id: 's1',
    name: 'Proveedor Global',
    email: 'ventas@global.com',
    phone: '+51 988 776 665',
    status: 'active',
    createdAt: new Date().toISOString()
  }
];

module.exports = {
  seededCategories,
  seededProducts,
  seededClients,
  seededSuppliers
};
