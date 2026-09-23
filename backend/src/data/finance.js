const accountSeed = [
  {
    id: 'acc1',
    code: '1010',
    name: 'Caja General',
    type: 'asset',
    balance: 15000,
    status: 'active'
  },
  {
    id: 'acc2',
    code: '2010',
    name: 'Proveedores',
    type: 'liability',
    balance: 4500,
    status: 'active'
  }
];

const movementSeed = [
  {
    id: 'fm1',
    accountId: 'acc1',
    type: 'credit',
    amount: 1500,
    concept: 'Ingreso inicial',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

const paymentSeed = [
  {
    id: 'pay1',
    type: 'cash',
    status: 'pending',
    amount: 250,
    reference: 'PAY-001',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

module.exports = {
  accountSeed,
  movementSeed,
  paymentSeed
};
