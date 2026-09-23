const dashboardMetricsSeed = {
  totalSales: 125000,
  totalPurchases: 87000,
  stockValue: 32000,
  monthlyRevenue: 15800,
  activeCustomers: 124,
  activeSuppliers: 18,
  pendingPayments: 4200,
  pendingOrders: 7
};

const chartSeed = [
  { label: 'Ene', value: 4200 },
  { label: 'Feb', value: 5900 },
  { label: 'Mar', value: 5000 },
  { label: 'Abr', value: 6600 },
  { label: 'May', value: 7100 },
  { label: 'Jun', value: 8200 }
];

module.exports = {
  dashboardMetricsSeed,
  chartSeed
};
