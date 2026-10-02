const service = require('../services/financeService');
const { successResponse } = require('../utils/response');

function listHandler(operation, label) {
  return async (req, res, next) => {
    try {
      const result = await operation(req.query);
      return res.status(200).json({ success: true, message: `${label} consultados correctamente`, data: result.items, pagination: result.pagination });
    } catch (error) { return next(error); }
  };
}

function detailHandler(operation, label, errorCode) {
  return async (req, res, next) => {
    try {
      const account = await operation(req.params.id);
      return account ? successResponse(res, 200, `${label} consultada correctamente`, account) : res.status(404).json({ success: false, message: `${label} no encontrada`, error: errorCode });
    } catch (error) { return next(error); }
  };
}

function paymentHandler(operation, label) {
  return async (req, res, next) => {
    try { return successResponse(res, 201, `${label} registrado correctamente`, await operation(req.params.id, req.body || {}, req.user.id)); }
    catch (error) { return next(error); }
  };
}

module.exports = {
  getReceivables: listHandler(service.listReceivables, 'Cuentas por cobrar'),
  getReceivable: detailHandler(service.getReceivable, 'Cuenta por cobrar', 'RECEIVABLE_NOT_FOUND'),
  payReceivable: paymentHandler(service.payReceivable, 'Cobro'),
  getPayables: listHandler(service.listPayables, 'Cuentas por pagar'),
  getPayable: detailHandler(service.getPayable, 'Cuenta por pagar', 'PAYABLE_NOT_FOUND'),
  payPayable: paymentHandler(service.payPayable, 'Pago'),
  getMovements: listHandler(service.listMovements, 'Movimientos financieros')
};
