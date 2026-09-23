const { listInventory, listWarehouses, addMovement, listMovements } = require('../services/inventoryService');
const { successResponse, errorResponse } = require('../utils/response');

function getInventory(req, res) {
  return successResponse(res, 200, 'Inventario consultado', listInventory());
}

function getWarehouses(req, res) {
  return successResponse(res, 200, 'Almacenes consultados', listWarehouses());
}

function addInventoryMovement(req, res) {
  try {
    const movement = addMovement(req.body);
    return successResponse(res, 201, 'Movimiento de inventario registrado', movement);
  } catch (error) {
    return errorResponse(res, 400, error.message, 'INVENTORY_MOVEMENT_ERROR');
  }
}

function getMovements(req, res) {
  return successResponse(res, 200, 'Movimientos de inventario consultados', listMovements());
}

module.exports = {
  getInventory,
  getWarehouses,
  addInventoryMovement,
  getMovements
};
