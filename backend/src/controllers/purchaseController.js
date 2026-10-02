const service = require('../services/purchaseService');
const { successResponse } = require('../utils/response');

async function listPurchases(req, res, next) {
  try {
    const result = await service.listPurchases(req.query);
    return res.status(200).json({ success: true, message: 'Compras consultadas correctamente', data: result.items, pagination: result.pagination });
  } catch (error) { return next(error); }
}

async function getPurchase(req, res, next) {
  try {
    const purchase = await service.getPurchaseById(req.params.id);
    return purchase ? successResponse(res, 200, 'Compra consultada correctamente', purchase) : res.status(404).json({ success: false, message: 'Compra no encontrada', error: 'PURCHASE_NOT_FOUND' });
  } catch (error) { return next(error); }
}

async function createPurchase(req, res, next) {
  try { return successResponse(res, 201, 'Borrador de compra creado correctamente', await service.createPurchase(req.body || {}, req.user.id)); }
  catch (error) { return next(error); }
}

async function updatePurchase(req, res, next) {
  try {
    const purchase = await service.updatePurchase(req.params.id, req.body || {}, req.user.id);
    return purchase ? successResponse(res, 200, 'Borrador de compra actualizado correctamente', purchase) : res.status(404).json({ success: false, message: 'Compra no encontrada', error: 'PURCHASE_NOT_FOUND' });
  } catch (error) { return next(error); }
}

async function orderPurchase(req, res, next) {
  try {
    const purchase = await service.orderPurchase(req.params.id, req.user.id);
    return purchase ? successResponse(res, 200, 'Compra ordenada correctamente', purchase) : res.status(404).json({ success: false, message: 'Compra no encontrada', error: 'PURCHASE_NOT_FOUND' });
  } catch (error) { return next(error); }
}

async function receivePurchase(req, res, next) {
  try {
    const purchase = await service.receivePurchase(req.params.id, req.user.id);
    return purchase ? successResponse(res, 200, 'Compra recibida correctamente', purchase) : res.status(404).json({ success: false, message: 'Compra no encontrada', error: 'PURCHASE_NOT_FOUND' });
  } catch (error) { return next(error); }
}

async function cancelPurchase(req, res, next) {
  try {
    const purchase = await service.cancelPurchase(req.params.id, req.user.id);
    return purchase ? successResponse(res, 200, 'Compra cancelada correctamente', purchase) : res.status(404).json({ success: false, message: 'Compra no encontrada', error: 'PURCHASE_NOT_FOUND' });
  } catch (error) { return next(error); }
}

module.exports = { listPurchases, getPurchase, createPurchase, updatePurchase, orderPurchase, receivePurchase, cancelPurchase };
