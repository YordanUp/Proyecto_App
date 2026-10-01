const demoModules = {
  sales: {
    label: 'Ventas', endpoint: '/api/sales/sales', permission: 'sales.read', badge: 'Datos de demostración',
    collections: [
      { label: 'Cotizaciones', endpoint: '/api/sales/quotations', titleField: 'id' },
      { label: 'Ventas', endpoint: '/api/sales/sales', titleField: 'id' }
    ]
  },
  purchases: {
    label: 'Compras', endpoint: '/api/purchases', permission: 'purchases.read', badge: 'Datos de demostración',
    collections: [
      { label: 'Órdenes de compra', endpoint: '/api/purchases/orders', titleField: 'id' },
      { label: 'Compras', endpoint: '/api/purchases', titleField: 'id' }
    ]
  },
  finance: {
    label: 'Finanzas', endpoint: '/api/finance/accounts', permission: 'finance.read', badge: 'Datos de demostración',
    collections: [
      { label: 'Cuentas', endpoint: '/api/finance/accounts', titleField: 'name' },
      { label: 'Movimientos', endpoint: '/api/finance/movements', titleField: 'concept' },
      { label: 'Pagos', endpoint: '/api/finance/payments', titleField: 'reference' }
    ]
  },
  inventory: {
    label: 'Inventario', endpoint: '/api/inventory', permission: 'inventory.read', badge: 'Datos de demostración',
    collections: [
      { label: 'Existencias', endpoint: '/api/inventory', titleField: 'productId' },
      { label: 'Movimientos', endpoint: '/api/inventory/movements', titleField: 'id' }
    ]
  }
};

module.exports = demoModules;
