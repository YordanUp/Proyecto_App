const service = require('../services/quotationService');
const { successResponse, errorResponse } = require('../utils/response');

async function list(req, res, next) {
  try {
    const result = await service.listQuotations(req.query);
    return res.status(200).json({ success: true, message: 'Cotizaciones consultadas correctamente', data: result.items, pagination: result.pagination });
  } catch (error) { return next(error); }
}

async function get(req, res, next) {
  try {
    const quotation = await service.getQuotationById(req.params.id);
    return quotation ? successResponse(res, 200, 'Cotización consultada correctamente', quotation)
      : errorResponse(res, 404, 'Cotización no encontrada', 'QUOTATION_NOT_FOUND');
  } catch (error) { return next(error); }
}

async function create(req, res, next) {
  try { return successResponse(res, 201, 'Cotización creada correctamente', await service.createQuotation(req.body || {}, req.user.id)); }
  catch (error) { return next(error); }
}

async function update(req, res, next) {
  try {
    const quotation = await service.updateQuotation(req.params.id, req.body || {}, req.user.id);
    return quotation ? successResponse(res, 200, 'Cotización actualizada correctamente', quotation)
      : errorResponse(res, 404, 'Cotización no encontrada', 'QUOTATION_NOT_FOUND');
  } catch (error) { return next(error); }
}

function transition(action, message) {
  return async (req, res, next) => {
    try {
      const quotation = await service.transitionQuotation(req.params.id, action, req.user.id);
      return quotation ? successResponse(res, 200, message, quotation)
        : errorResponse(res, 404, 'Cotización no encontrada', 'QUOTATION_NOT_FOUND');
    } catch (error) { return next(error); }
  };
}

async function convert(req, res, next) {
  try {
    const result = await service.convertQuotation(req.params.id, req.user.id);
    return result ? successResponse(res, 201, 'Cotización convertida a venta borrador', result)
      : errorResponse(res, 404, 'Cotización no encontrada', 'QUOTATION_NOT_FOUND');
  } catch (error) { return next(error); }
}

module.exports = {
  list, get, create, update, convert,
  send: transition('send', 'Cotización enviada correctamente'),
  accept: transition('accept', 'Cotización aceptada correctamente'),
  reject: transition('reject', 'Cotización rechazada correctamente'),
  cancel: transition('cancel', 'Cotización cancelada correctamente')
};
