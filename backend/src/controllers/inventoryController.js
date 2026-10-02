const service = require('../services/inventoryService');
const { successResponse } = require('../utils/response');

async function getInventory(req, res, next) {
  try {
    const result = await service.listInventory(req.query);
    return res.status(200).json({ success: true, message: 'Existencias consultadas correctamente', data: result.items, pagination: result.pagination });
  } catch (error) { return next(error); }
}

async function getWarehouses(req, res, next) {
  try { return successResponse(res, 200, 'Almacenes consultados correctamente', await service.listWarehouses()); }
  catch (error) { return next(error); }
}

async function getMovements(req, res, next) {
  try {
    const result = await service.listMovements(req.query);
    return res.status(200).json({ success: true, message: 'Movimientos consultados correctamente', data: result.items, pagination: result.pagination });
  } catch (error) { return next(error); }
}

function movementHandler(operation, message) {
  return async (req, res, next) => {
    try { return successResponse(res, 201, message, await operation(req.body || {}, req.user.id)); }
    catch (error) { return next(error); }
  };
}

module.exports = {
  getInventory,
  getWarehouses,
  getMovements,
  addEntry: movementHandler(service.addEntry, 'Entrada de inventario registrada'),
  addExit: movementHandler(service.addExit, 'Salida de inventario registrada'),
  adjustStock: movementHandler(service.adjustStock, 'Existencia ajustada correctamente'),
  transferStock: movementHandler(service.transferStock, 'Transferencia de inventario completada')
};
