const quotationSeed = [
  {
    id: 'q1',
    customerId: 'cl1',
    status: 'draft',
    total: 260,
    items: [
      { productId: 'p1', quantity: 1, unitPrice: 260 }
    ],
    createdAt: new Date().toISOString()
  }
];

const saleSeed = [
  {
    id: 's1',
    customerId: 'cl1',
    status: 'confirmed',
    total: 260,
    items: [
      { productId: 'p1', quantity: 1, unitPrice: 260 }
    ],
    createdAt: new Date().toISOString()
  }
];

const returnSaleSeed = [
  {
    id: 'rs1',
    saleId: 's1',
    reason: 'Devolución por daño',
    status: 'requested',
    createdAt: new Date().toISOString()
  }
];

module.exports = {
  quotationSeed,
  saleSeed,
  returnSaleSeed
};
