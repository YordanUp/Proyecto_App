const config = require('../config/config');

let resendClient = null;
let testClient = null;

function getClient() {
  if (testClient) return testClient;
  if (!config.emailEnabled) return null;
  if (!resendClient) {
    const { Resend } = require('resend');
    resendClient = new Resend(config.resendApiKey);
  }
  return resendClient;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function emailLayout({ title, name, body, actionLabel, actionUrl }) {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(actionUrl);
  return `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#172b4d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:12px"><tr><td style="padding:32px"><div style="font-weight:700;color:#17365d;font-size:18px;margin-bottom:28px">YordanUp ERP</div><h1 style="font-size:24px;margin:0 0 18px">${escapeHtml(title)}</h1><p>Hola ${safeName},</p>${body}<p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#17365d;color:#fff;text-decoration:none;padding:13px 20px;border-radius:6px;font-weight:700">${escapeHtml(actionLabel)}</a></p><p style="font-size:13px;color:#667085">Si no solicitaste esta acción, puedes ignorar este mensaje.</p></td></tr></table></td></tr></table></body></html>`;
}

async function deliver({ to, subject, html, text, idempotencyKey }) {
  if (!config.emailEnabled && !testClient) {
    console.info('Correo transaccional no enviado: EMAIL_ENABLED está desactivado');
    return { sent: false, reason: 'EMAIL_DISABLED' };
  }
  try {
    const client = getClient();
    const response = await client.emails.send({ from: config.resendFromEmail, to, subject, html, text }, { idempotencyKey });
    if (response?.error) {
      const recipientBlocked = response.error.statusCode === 403 || response.error.status === 403;
      const safeMessage = recipientBlocked && config.resendFromEmail === 'onboarding@resend.dev'
        ? 'Proveedor de correo rechazó el destinatario en modo de prueba.'
        : 'Proveedor de correo rechazó el envío.';
      console.error(safeMessage);
      return { sent: false, reason: recipientBlocked ? 'RECIPIENT_REJECTED' : 'PROVIDER_REJECTED' };
    }
    if (!response?.data?.id) {
      console.error('El proveedor de correo no confirmó la aceptación del envío.');
      return { sent: false, reason: 'PROVIDER_UNCONFIRMED' };
    }
    return { sent: true, id: response?.data?.id || null };
  } catch (error) {
    const recipientBlocked = error?.statusCode === 403 || error?.status === 403;
    console.error(recipientBlocked && config.resendFromEmail === 'onboarding@resend.dev'
      ? 'Proveedor de correo rechazó el destinatario en modo de prueba.'
      : 'Falló el envío transaccional de correo.');
    return { sent: false, reason: recipientBlocked ? 'RECIPIENT_REJECTED' : 'PROVIDER_ERROR' };
  }
}

async function sendVerificationEmail({ user, token, idempotencyKey }) {
  const url = `${config.appPublicUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
  const html = emailLayout({ title: 'Confirma tu cuenta', name: user.name, body: '<p>Confirma tu correo para activar el acceso a tu cuenta del ERP.</p>', actionLabel: 'Confirmar mi cuenta', actionUrl: url });
  return deliver({ to: user.email, subject: 'Confirma tu cuenta de YordanUp ERP', html, text: `Hola ${user.name}, confirma tu cuenta: ${url}`, idempotencyKey });
}

async function sendWelcomeEmail({ user, idempotencyKey }) {
  const url = `${config.appPublicUrl.replace(/\/$/, '')}/login`;
  const html = emailLayout({ title: 'Bienvenido al ERP', name: user.name, body: '<p>Tu cuenta quedó activa y tu correo fue verificado. Ya puedes iniciar sesión.</p>', actionLabel: 'Iniciar sesión', actionUrl: url });
  return deliver({ to: user.email, subject: 'Bienvenido al ERP', html, text: `Hola ${user.name}, tu cuenta quedó activa y verificada. Inicia sesión: ${url}`, idempotencyKey });
}

function setTestClient(client) {
  if (config.nodeEnv !== 'test') throw new Error('El cliente de prueba solo está disponible en entorno test');
  testClient = client;
}

module.exports = { sendVerificationEmail, sendWelcomeEmail, setTestClient };
