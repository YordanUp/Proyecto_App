const { purchaseOrderSeed, purchaseSeed } = require('../data/purchases');

const purchaseOrders = purchaseOrderSeed;
const purchases = purchaseSeed;

function listPurchaseOrders() {
  return purchaseOrders;
}

function createPurchaseOrder(data) {
  if (!data.supplierId || !Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('Proveedor e items son requeridos para la orden de compra');
  }

  const order = {
    id: `po${Date.now()}`,
    supplierId: data.supplierId,
    status: data.status || 'draft',
    total: data.total || 0,
    items: data.items,
    createdAt: new Date().toISOString()
  };

  purchaseOrders.push(order);
  return order;
}

function listPurchases() {
  return purchases;
}

function createPurchase(data) {
  if (!data.supplierId || !Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('Proveedor e items son requeridos para la compra');
  }

  const purchase = {
    id: `pu${Date.now()}`,
    supplierId: data.supplierId,
    status: data.status || 'received',
    total: data.total || 0,
    items: data.items,
    createdAt: new Date().toISOString()
  };

  purchases.push(purchase);
  return purchase;
}

module.exports = {
  listPurchaseOrders,
  createPurchaseOrder,
  listPurchases,
  createPurchase
};
