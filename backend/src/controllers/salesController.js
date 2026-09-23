const { listQuotations, createQuotation, listSales, createSale, createReturnSale } = require('../services/salesService');
const { successResponse, errorResponse } = require('../utils/response');

function getQuotations(req, res) {
  return successResponse(res, 200, 'Cotizaciones consultadas', listQuotations());
}

function createQuotationController(req, res) {
  try {
    const quotation = createQuotation(req.body);
    return successResponse(res, 201, 'Cotización creada correctamente', quotation);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'QUOTATION_CREATE_ERROR');
  }
}

function getSales(req, res) {
  return successResponse(res, 200, 'Ventas consultadas', listSales());
}

function createSaleController(req, res) {
  try {
    const sale = createSale(req.body);
    return successResponse(res, 201, 'Venta creada correctamente', sale);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'SALE_CREATE_ERROR');
  }
}

function createReturnSaleController(req, res) {
  try {
    const returnSale = createReturnSale(req.body);
    return successResponse(res, 201, 'Devolución registrada correctamente', returnSale);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'RETURN_SALE_CREATE_ERROR');
  }
}

module.exports = {
  getQuotations,
  createQuotationController,
  getSales,
  createSaleController,
  createReturnSaleController
};
