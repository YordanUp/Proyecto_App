const integrationSeed = [
  {
    id: 'int1',
    name: 'ERP Cloud Sync',
    type: 'crm',
    status: 'connected',
    lastSync: '2026-01-03T10:15:00.000Z',
    owner: 'Operaciones',
    enabled: true
  },
  {
    id: 'int2',
    name: 'WhatsApp Business',
    type: 'messaging',
    status: 'pending',
    lastSync: '2026-01-02T14:00:00.000Z',
    owner: 'Atención al cliente',
    enabled: false
  },
  {
    id: 'int3',
    name: 'Stripe',
    type: 'payments',
    status: 'connected',
    lastSync: '2026-01-03T09:30:00.000Z',
    owner: 'Finanzas',
    enabled: true
  }
];

module.exports = { integrationSeed };
