const settingsSeed = [
  {
    id: 'set1',
    key: 'company_name',
    label: 'Nombre de la empresa',
    value: 'ERP Modular',
    type: 'text',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'set2',
    key: 'currency',
    label: 'Moneda base',
    value: 'USD',
    type: 'select',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'set3',
    key: 'timezone',
    label: 'Zona horaria',
    value: 'UTC-5',
    type: 'text',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'set4',
    key: 'inventory_negative',
    label: 'Permitir stock negativo',
    value: false,
    type: 'boolean',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
];

module.exports = { settingsSeed };
