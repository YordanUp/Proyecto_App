const { accountSeed, movementSeed, paymentSeed } = require('../data/finance');

const accounts = accountSeed;
const movements = movementSeed;
const payments = paymentSeed;

function listAccounts() {
  return accounts;
}

function createAccount(data) {
  if (!data.code || !data.name || !data.type) {
    throw new Error('Código, nombre y tipo de cuenta son requeridos');
  }

  const account = {
    id: `acc${Date.now()}`,
    code: data.code,
    name: data.name,
    type: data.type,
    balance: Number(data.balance || 0),
    status: data.status || 'active',
    createdAt: new Date().toISOString()
  };

  accounts.push(account);
  return account;
}

function listMovements() {
  return movements;
}

function createMovement(data) {
  if (!data.accountId || !data.type || !data.amount || !data.concept) {
    throw new Error('Cuenta, tipo, monto y concepto son requeridos');
  }

  const movement = {
    id: `fm${Date.now()}`,
    accountId: data.accountId,
    type: data.type,
    amount: Number(data.amount),
    concept: data.concept,
    createdAt: new Date().toISOString()
  };

  movements.push(movement);

  const account = accounts.find((entry) => entry.id === data.accountId);
  if (account) {
    account.balance = data.type === 'credit' ? account.balance + Number(data.amount) : account.balance - Number(data.amount);
  }

  return movement;
}

function listPayments() {
  return payments;
}

function createPayment(data) {
  if (!data.type || !data.amount || !data.reference) {
    throw new Error('Tipo, monto y referencia son requeridos');
  }

  const payment = {
    id: `pay${Date.now()}`,
    type: data.type,
    status: data.status || 'pending',
    amount: Number(data.amount),
    reference: data.reference,
    createdAt: new Date().toISOString()
  };

  payments.push(payment);
  return payment;
}

module.exports = {
  listAccounts,
  createAccount,
  listMovements,
  createMovement,
  listPayments,
  createPayment
};
