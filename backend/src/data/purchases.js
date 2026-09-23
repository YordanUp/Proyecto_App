const purchaseOrderSeed = [
  {
    id: 'po1',
    supplierId: 's1',
    status: 'draft',
    total: 540,
    items: [
      { productId: 'p1', quantity: 10, unitPrice: 54 }
    ],
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

const purchaseSeed = [
  {
    id: 'pu1',
    supplierId: 's1',
    status: 'received',
    total: 540,
    items: [
      { productId: 'p1', quantity: 10, unitPrice: 54 }
    ],
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

module.exports = {
  purchaseOrderSeed,
  purchaseSeed
};
