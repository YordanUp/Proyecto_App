const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const roleRoutes = require('./roleRoutes');
const productRoutes = require('./productRoutes');
const clientRoutes = require('./clientRoutes');
const supplierRoutes = require('./supplierRoutes');
const categoryRoutes = require('./categoryRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const saleRoutes = require('./saleRoutes');
const purchaseRoutes = require('./purchaseRoutes');
const financeRoutes = require('./financeRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const reportRoutes = require('./reportRoutes');
const settingsRoutes = require('./settingsRoutes');
const integrationsRoutes = require('./integrationsRoutes');
const warehouseRoutes = require('./warehouseRoutes');
const { mongoose } = require('../config/database');

const router = express.Router();

router.get('/health', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json(ready ? {
    success: true, message: 'Backend y base de datos disponibles',
    data: { status: 'ready', database: 'connected', uptime: process.uptime(), timestamp: new Date().toISOString() }
  } : {
    success: false, message: 'Base de datos no disponible', error: 'DATABASE_UNAVAILABLE',
    data: { status: 'not_ready', database: 'disconnected', timestamp: new Date().toISOString() }
  });
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API ERP base',
    data: {
      endpoints: [
        'GET /api/health',
        'GET /api',
        'POST /api/auth/login',
        'POST /api/auth/verify-email',
        'POST /api/auth/resend-verification',
        'GET /api/auth/me',
        'GET /api/auth/profile',
        'PATCH /api/auth/password',
        'GET /api/users',
        'GET /api/roles',
        'GET /api/products',
        'GET /api/clients',
        'GET /api/suppliers',
        'GET /api/categories',
        'GET /api/warehouses',
        'GET /api/inventory',
        'GET /api/inventory/movements',
        'POST /api/inventory/entry',
        'POST /api/inventory/exit',
        'POST /api/inventory/adjust',
        'POST /api/inventory/transfer',
        'GET /api/sales',
        'POST /api/sales',
        'GET /api/sales/:id',
        'PUT /api/sales/:id',
        'POST /api/sales/:id/confirm',
        'POST /api/sales/:id/cancel',
        'GET /api/purchases',
        'POST /api/purchases',
        'GET /api/purchases/:id',
        'PUT /api/purchases/:id',
        'POST /api/purchases/:id/order',
        'POST /api/purchases/:id/receive',
        'POST /api/purchases/:id/cancel',
        'GET /api/finance/receivables',
        'GET /api/finance/receivables/:id',
        'POST /api/finance/receivables/:id/payments',
        'GET /api/finance/payables',
        'GET /api/finance/payables/:id',
        'POST /api/finance/payables/:id/payments',
        'GET /api/finance/movements',
        'GET /api/sales/quotations',
        'POST /api/sales/quotations',
        'GET /api/sales/quotations/:id',
        'PUT /api/sales/quotations/:id',
        'POST /api/sales/quotations/:id/send',
        'POST /api/sales/quotations/:id/accept',
        'POST /api/sales/quotations/:id/reject',
        'POST /api/sales/quotations/:id/cancel',
        'POST /api/sales/quotations/:id/convert',
        'GET /api/sales/sales',
        'GET /api/purchases/orders',
        'GET /api/purchases',
        'GET /api/dashboard',
        'GET /api/reports/data/:type',
        'GET /api/reports/data/:type/export.csv',
        'GET /api/reports/notifications',
        'GET /api/settings',
        'POST /api/settings',
        'GET /api/integrations'
      ]
    }
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/products', productRoutes);
router.use('/clients', clientRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/categories', categoryRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/sales', saleRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/finance', financeRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', settingsRoutes);
router.use('/integrations', integrationsRoutes);

module.exports = router;
