const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const InventoryStock = require('../models/InventoryStock');
const AccountsReceivable = require('../models/AccountsReceivable');
const AccountsPayable = require('../models/AccountsPayable');
const FinancialMovement = require('../models/FinancialMovement');

function utcRanges(now = new Date()) {
  const todayFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(todayFrom);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const monthFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { today: { $gte: todayFrom, $lt: tomorrow }, month: { $gte: monthFrom, $lt: nextMonth } };
}

async function getMetrics(now = new Date()) {
  const ranges = utcRanges(now);
  const [sales, purchaseMetrics, inventoryMetrics, receivables, payables, recentMovements, recentSales] = await Promise.all([
    Sale.aggregate([{ $match: { status: 'confirmed' } }, { $facet: {
      today: [{ $match: { confirmedAt: ranges.today } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }],
      month: [{ $match: { confirmedAt: ranges.month } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }],
      confirmed: [{ $count: 'count' }]
    } }]),
    Purchase.aggregate([{ $facet: {
      pending: [{ $match: { status: 'ordered' } }, { $count: 'count' }],
      receivedMonth: [{ $match: { status: 'received', receivedAt: ranges.month } }, { $count: 'count' }]
    } }]),
    InventoryStock.aggregate([{ $addFields: { availableQuantity: { $subtract: ['$quantity', '$reservedQuantity'] } } }, { $facet: {
      low: [{ $match: { $expr: { $lte: ['$availableQuantity', '$minimumStock'] } } }, { $count: 'count' }],
      out: [{ $match: { availableQuantity: { $lte: 0 } } }, { $count: 'count' }],
      alerts: [{ $match: { $expr: { $lte: ['$availableQuantity', '$minimumStock'] } } }, { $sort: { availableQuantity: 1, updatedAt: -1 } }, { $limit: 5 },
        { $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' } }, { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'warehouses', localField: 'warehouseId', foreignField: '_id', as: 'warehouse' } }, { $unwind: { path: '$warehouse', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, quantity: 1, reservedQuantity: 1, availableQuantity: 1, minimumStock: 1, product: { name: '$product.name', code: '$product.code' }, warehouse: { name: '$warehouse.name' } } }]
    } }]),
    AccountsReceivable.aggregate([{ $match: { status: { $in: ['pending', 'partial'] } } }, { $group: { _id: null, count: { $sum: 1 }, balance: { $sum: '$balance' } } }]),
    AccountsPayable.aggregate([{ $match: { status: { $in: ['pending', 'partial'] } } }, { $group: { _id: null, count: { $sum: 1 }, balance: { $sum: '$balance' } } }]),
    FinancialMovement.find().sort({ createdAt: -1, _id: -1 }).limit(5).populate('createdBy', 'name').populate({ path: 'referenceId', select: 'folio' }).lean(),
    Sale.find({ status: 'confirmed' }).sort({ confirmedAt: -1, _id: -1 }).limit(5).populate('customer', 'name').select('folio total confirmedAt customer status').lean()
  ]);
  const salesData = sales[0] || {};
  const purchaseData = purchaseMetrics[0] || {};
  const stockData = inventoryMetrics[0] || {};
  const receivable = receivables[0] || { count: 0, balance: 0 };
  const payable = payables[0] || { count: 0, balance: 0 };
  return {
    metrics: {
      salesToday: salesData.today?.[0]?.total || 0,
      salesMonth: salesData.month?.[0]?.total || 0,
      salesCountToday: salesData.today?.[0]?.count || 0,
      confirmedSalesCount: salesData.confirmed?.[0]?.count || 0,
      pendingPurchases: purchaseData.pending?.[0]?.count || 0,
      receivedPurchasesMonth: purchaseData.receivedMonth?.[0]?.count || 0,
      lowStockCount: stockData.low?.[0]?.count || 0,
      outOfStockCount: stockData.out?.[0]?.count || 0,
      receivables: { count: receivable.count, balance: receivable.balance },
      payables: { count: payable.count, balance: payable.balance }
    },
    recentSales: recentSales.map(item => ({ ...item, id: String(item._id) })),
    recentFinancialMovements: recentMovements.map(item => ({ ...item, id: String(item._id) })),
    stockAlerts: stockData.alerts || [],
    generatedAt: new Date().toISOString()
  };
}

module.exports = { getMetrics, utcRanges };
