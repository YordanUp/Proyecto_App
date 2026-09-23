const inventorySeed = [
  {
    id: 'inv1',
    productId: 'p1',
    warehouseId: 'w1',
    stock: 15,
    minStock: 10,
    status: 'active',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'inv2',
    productId: 'p2',
    warehouseId: 'w1',
    stock: 9,
    minStock: 8,
    status: 'active',
    updatedAt: new Date().toISOString()
  }
];

const movementSeed = [
  {
    id: 'm1',
    productId: 'p1',
    type: 'entry',
    quantity: 10,
    warehouseId: 'w1',
    userId: 'u1',
    reason: 'Compra inicial',
    documentId: 'doc-001',
    createdAt: new Date().toISOString()
  }
];

const warehouseSeed = [
  {
    id: 'w1',
    name: 'Almacén Central',
    address: 'Lima Centro',
    status: 'active',
    createdAt: new Date().toISOString()
  }
];

module.exports = {
  inventorySeed,
  movementSeed,
  warehouseSeed
};
