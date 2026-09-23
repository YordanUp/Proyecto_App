function validateString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} es requerido`);
  }
}

function validateProductInput(data) {
  validateString(data.name, 'Nombre del producto');
  validateString(data.code, 'Código del producto');

  if (!data.categoryId) {
    throw new Error('La categoría es requerida');
  }

  if (!Number.isFinite(Number(data.purchasePrice))) {
    throw new Error('El precio de compra es requerido');
  }

  if (!Number.isFinite(Number(data.salePrice))) {
    throw new Error('El precio de venta es requerido');
  }

  if (Number(data.salePrice) < Number(data.purchasePrice)) {
    throw new Error('El precio de venta no puede ser menor al precio de compra');
  }
}

function validateClientInput(data) {
  validateString(data.name, 'Nombre del cliente');
  validateString(data.email, 'Email del cliente');
}

function validateSupplierInput(data) {
  validateString(data.name, 'Nombre del proveedor');
  validateString(data.email, 'Email del proveedor');
}

function validateCategoryInput(data) {
  validateString(data.name, 'Nombre de la categoría');
}

module.exports = {
  validateProductInput,
  validateClientInput,
  validateSupplierInput,
  validateCategoryInput
};
