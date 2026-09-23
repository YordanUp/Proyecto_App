const { listAccounts, createAccount, listMovements, createMovement, listPayments, createPayment } = require('../services/financeService');
const { successResponse, errorResponse } = require('../utils/response');

function getAccounts(req, res) {
  return successResponse(res, 200, 'Cuentas consultadas', listAccounts());
}

function createAccountController(req, res) {
  try {
    const account = createAccount(req.body);
    return successResponse(res, 201, 'Cuenta creada correctamente', account);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'ACCOUNT_CREATE_ERROR');
  }
}

function getMovements(req, res) {
  return successResponse(res, 200, 'Movimientos financieros consultados', listMovements());
}

function createMovementController(req, res) {
  try {
    const movement = createMovement(req.body);
    return successResponse(res, 201, 'Movimiento financiero registrado', movement);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'FINANCE_MOVEMENT_ERROR');
  }
}

function getPayments(req, res) {
  return successResponse(res, 200, 'Pagos consultados', listPayments());
}

function createPaymentController(req, res) {
  try {
    const payment = createPayment(req.body);
    return successResponse(res, 201, 'Pago registrado correctamente', payment);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'PAYMENT_CREATE_ERROR');
  }
}

module.exports = {
  getAccounts,
  createAccountController,
  getMovements,
  createMovementController,
  getPayments,
  createPaymentController
};
