const { quotationSeed, returnSaleSeed } = require('../data/sales');

const quotations = quotationSeed;
const returns = returnSaleSeed;

function listQuotations() { return quotations; }

function createQuotation(data) {
  if (!data.customerId || !Array.isArray(data.items) || data.items.length === 0) throw new Error('Cliente e items son requeridos para la cotización');
  const quotation = { id: `q${Date.now()}`, customerId: data.customerId, status: 'draft', total: data.total || 0, items: data.items, createdAt: new Date().toISOString() };
  quotations.push(quotation);
  return quotation;
}

function createReturnSale(data) {
  if (!data.saleId || !data.reason) throw new Error('Venta y motivo son requeridos');
  const returnSale = { id: `rs${Date.now()}`, saleId: data.saleId, reason: data.reason, status: data.status || 'requested', createdAt: new Date().toISOString() };
  returns.push(returnSale);
  return returnSale;
}

module.exports = { listQuotations, createQuotation, createReturnSale };
