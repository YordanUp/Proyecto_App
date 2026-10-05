const { returnSaleSeed } = require('../data/sales');
const returns = returnSaleSeed;

function createReturnSale(data) {
  if (!data.saleId || !data.reason) throw new Error('Venta y motivo son requeridos');
  const returnSale = { id: `rs${Date.now()}`, saleId: data.saleId, reason: data.reason, status: data.status || 'requested', createdAt: new Date().toISOString() };
  returns.push(returnSale);
  return returnSale;
}

module.exports = { createReturnSale };
