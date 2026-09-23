const { listPurchaseOrders, createPurchaseOrder, listPurchases, createPurchase } = require('../services/purchaseService');
const { successResponse, errorResponse } = require('../utils/response');

function getPurchaseOrders(req, res) {
  return successResponse(res, 200, 'Órdenes de compra consultadas', listPurchaseOrders());
}

function createPurchaseOrderController(req, res) {
  try {
    const order = createPurchaseOrder(req.body);
    return successResponse(res, 201, 'Orden de compra creada correctamente', order);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'PURCHASE_ORDER_CREATE_ERROR');
  }
}

function getPurchases(req, res) {
  return successResponse(res, 200, 'Compras consultadas', listPurchases());
}

function createPurchaseController(req, res) {
  try {
    const purchase = createPurchase(req.body);
    return successResponse(res, 201, 'Compra registrada correctamente', purchase);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'PURCHASE_CREATE_ERROR');
  }
}

module.exports = {
  getPurchaseOrders,
  createPurchaseOrderController,
  getPurchases,
  createPurchaseController
};
