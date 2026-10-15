const UNIT_QUANTITY_ERROR = 'La cantidad debe ser un número entero mayor o igual a 1.';

function isValidUnitQuantity(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  const quantity = Number(value);
  return Number.isFinite(quantity) && Number.isInteger(quantity) && quantity >= 1;
}

module.exports = { UNIT_QUANTITY_ERROR, isValidUnitQuantity };
