const service = require('../services/salesService');
const legacyService = require('../services/legacySalesService');
const { successResponse, errorResponse } = require('../utils/response');

function getQuotations(req, res) {
  return successResponse(res, 200, 'Cotizaciones demostrativas consultadas', legacyService.listQuotations());
}

function createQuotationController(req, res) {
  try { return successResponse(res, 201, 'Cotización demostrativa creada', legacyService.createQuotation(req.body)); }
  catch (error) { return errorResponse(res, 400, error.message, 'QUOTATION_CREATE_ERROR'); }
}

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

function createReturnSaleController(req, res) {
  try { return successResponse(res, 201, 'Solicitud de devolución demostrativa registrada', legacyService.createReturnSale(req.body)); }
  catch (error) { return errorResponse(res, 400, error.message, 'RETURN_SALE_CREATE_ERROR'); }
}

module.exports = { getQuotations, createQuotationController, getSales, getSale, createSaleController, updateSale, confirmSale, cancelSale, createReturnSaleController };
