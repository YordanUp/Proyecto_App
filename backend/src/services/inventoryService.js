const { inventorySeed, movementSeed, warehouseSeed } = require('../data/inventory');

const inventory = inventorySeed;
const movements = movementSeed;
const warehouses = warehouseSeed;

function listInventory() {
  return inventory;
}

function listWarehouses() {
  return warehouses;
}

function addMovement(data) {
  if (!data.productId || !data.type || !data.quantity || !data.warehouseId || !data.userId) {
    throw new Error('Producto, tipo, cantidad, almacén y usuario son requeridos');
  }

  const quantity = Number(data.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('La cantidad debe ser un número mayor a cero');
  }

  const movement = {
    id: `m${Date.now()}`,
    productId: data.productId,
    type: data.type,
    quantity,
    warehouseId: data.warehouseId,
    userId: data.userId,
    reason: data.reason || 'Sin motivo',
    documentId: data.documentId || '',
    createdAt: new Date().toISOString()
  };

  movements.push(movement);

  const current = inventory.find((item) => item.productId === data.productId && item.warehouseId === data.warehouseId);
  if (!current) {
    inventory.push({
      id: `inv${Date.now()}`,
      productId: data.productId,
      warehouseId: data.warehouseId,
      stock: data.type === 'entry' ? quantity : 0,
      minStock: 0,
      status: 'active',
      updatedAt: new Date().toISOString()
    });
    return movement;
  }

  const nextStock = data.type === 'entry' ? current.stock + quantity : current.stock - quantity;

  if (nextStock < 0) {
    throw new Error('No hay suficiente inventario para esta salida');
  }

  current.stock = nextStock;
  current.updatedAt = new Date().toISOString();

  return movement;
}

function listMovements() {
  return movements;
}

module.exports = {
  listInventory,
  listWarehouses,
  addMovement,
  listMovements
};
