const service = require('../services/salesService');
const returnService = require('../services/salesReturnService');
const { successResponse } = require('../utils/response');

async function getSales(req, res, next) {
  try {
    const result = await service.listSales(req.query);
    return res.status(200).json({ success: true, message: 'Ventas consultadas correctamente', data: result.items, pagination: result.pagination });
  } catch (error) { return next(error); }
}

async function getSale(req, res, next) {
  try {
    const sale = await service.getSaleById(req.params.id);
    return sale ? successResponse(res, 200, 'Venta consultada correctamente', sale) : res.status(404).json({ success: false, message: 'Venta no encontrada', error: 'SALE_NOT_FOUND' });
  } catch (error) { return next(error); }
}

async function createSaleController(req, res, next) {
  try { return successResponse(res, 201, 'Borrador de venta creado correctamente', await service.createSale(req.body || {}, req.user.id)); }
  catch (error) { return next(error); }
}

async function updateSale(req, res, next) {
  try {
    const sale = await service.updateSale(req.params.id, req.body || {}, req.user.id);
    return sale ? successResponse(res, 200, 'Borrador de venta actualizado correctamente', sale) : res.status(404).json({ success: false, message: 'Venta no encontrada', error: 'SALE_NOT_FOUND' });
  } catch (error) { return next(error); }
}

async function confirmSale(req, res, next) {
  try {
    const sale = await service.confirmSale(req.params.id, req.user.id);
    return sale ? successResponse(res, 200, 'Venta confirmada correctamente', sale) : res.status(404).json({ success: false, message: 'Venta no encontrada', error: 'SALE_NOT_FOUND' });
  } catch (error) { return next(error); }
}

async function cancelSale(req, res, next) {
  try {
    const sale = await service.cancelSale(req.params.id, req.user.id);
    return sale ? successResponse(res, 200, 'Venta cancelada correctamente', sale) : res.status(404).json({ success: false, message: 'Venta no encontrada', error: 'SALE_NOT_FOUND' });
  } catch (error) { return next(error); }
}

async function listSalesReturns(req, res, next) {
  try {
    const result = await returnService.listSalesReturns(req.query);
    return res.status(200).json({ success: true, message: 'Devoluciones consultadas correctamente', data: result.items, pagination: result.pagination });
  } catch (error) { return next(error); }
}

async function getSalesReturn(req, res, next) {
  try {
    const item = await returnService.getSalesReturnById(req.params.id);
    return item ? successResponse(res, 200, 'Devolución consultada correctamente', item) : res.status(404).json({ success: false, message: 'Devolución no encontrada', error: 'SALES_RETURN_NOT_FOUND' });
  } catch (error) { return next(error); }
}

async function createSalesReturn(req, res, next) {
  try { return successResponse(res, 201, 'Devolución procesada correctamente', await returnService.createSalesReturn(req.body || {}, req.user.id)); }
  catch (error) { return next(error); }
}

module.exports = { getSales, getSale, createSaleController, updateSale, confirmSale, cancelSale, listSalesReturns, getSalesReturn, createSalesReturn };
