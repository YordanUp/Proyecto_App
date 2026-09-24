const reportSeed = [
  {
    id: 'rep1',
    type: 'sales',
    title: 'Resumen de ventas',
    generatedAt: '2026-01-01T00:00:00.000Z',
    status: 'ready'
  },
  {
    id: 'rep2',
    type: 'inventory',
    title: 'Inventario crítico',
    generatedAt: '2026-01-02T00:00:00.000Z',
    status: 'ready'
  }
];

const notificationSeed = [
  {
    id: 'nt1',
    title: 'Pedido pendiente',
    message: 'Hay 7 órdenes pendientes de aprobación',
    type: 'warning',
    read: false,
    createdAt: '2026-01-03T00:00:00.000Z'
  }
];

module.exports = {
  reportSeed,
  notificationSeed
};
