process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createVerificationToken, TOKEN_TTL_MS } = require('../src/services/emailVerificationService');
const emailService = require('../src/services/emailService');

test('EMAIL-001/002: el token es aleatorio, opaco y solo se deriva un hash persistible', () => {
  const first = createVerificationToken();
  const second = createVerificationToken();
  assert.match(first.token, /^[A-Za-z0-9_-]{40,100}$/);
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(first.token, first.tokenHash);
  assert.notEqual(first.tokenHash, second.tokenHash);
  assert.equal(TOKEN_TTL_MS, 24 * 60 * 60 * 1000);
});

test('el correo de verificación usa HTML/texto, escapa datos y aplica idempotencia', async () => {
  const sent = [];
  emailService.setTestClient({ emails: { send: async (payload, options) => { sent.push({ payload, options }); return { data: { id: 'test-id' } }; } } });
  const result = await emailService.sendVerificationEmail({ user: { id: 'user-id', name: '<script>alert(1)</script>', email: 'safe@example.invalid' }, token: 'random-token', idempotencyKey: 'verification-user-v1' });
  assert.equal(result.sent, true);
  assert.equal(sent.length, 1);
  assert.match(sent[0].payload.html, /&lt;script&gt;/);
  assert.match(sent[0].payload.html, /Confirmar mi cuenta/);
  assert.match(sent[0].payload.text, /verify-email\?token=random-token/);
  assert.equal(sent[0].options.idempotencyKey, 'verification-user-v1');
  assert.equal(sent[0].payload.to, 'safe@example.invalid');
});

test('un rechazo 403 de Resend devuelve estado pendiente sin filtrar detalles del proveedor', async () => {
  emailService.setTestClient({ emails: { send: async () => ({ error: { statusCode: 403, message: 'private recipient information' } }) } });
  const originalError = console.error;
  const logs = [];
  console.error = message => logs.push(String(message));
  try {
    const result = await emailService.sendVerificationEmail({ user: { name: 'Ana', email: 'ana@example.invalid' }, token: 't', idempotencyKey: 'idempotency-test' });
    assert.deepEqual(result, { sent: false, reason: 'RECIPIENT_REJECTED' });
    assert.equal(logs.some(message => message.includes('private recipient information')), false);
  } finally { console.error = originalError; }
});
