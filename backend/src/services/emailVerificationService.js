const crypto = require('node:crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const emailService = require('./emailService');
const { recordAudit } = require('./auditService');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,100}$/;

function createVerificationToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: crypto.createHash('sha256').update(token).digest('hex') };
}

function safeAudit(entry) {
  return recordAudit(entry).catch(() => console.error('No fue posible guardar auditoría de correo.'));
}

async function dispatchVerification(user, token, tokenHash, actorId, action = 'email.verification.sent') {
  const result = await emailService.sendVerificationEmail({
    user,
    token,
    idempotencyKey: `verification-${user.id}-${tokenHash.slice(0, 16)}`
  });
  await safeAudit({ userId: actorId || user.id, action: result.sent ? action : 'email.send.failed', module: 'auth', recordId: user.id, after: { purpose: 'verification', reason: result.reason || null } });
  return result;
}

async function issueVerification(userId, actorId, action = 'email.verification.resent') {
  const { token, tokenHash } = createVerificationToken();
  const user = await User.findOneAndUpdate(
    { _id: userId, emailVerified: false, status: 'active' },
    { $set: { emailVerificationTokenHash: tokenHash, emailVerificationExpiresAt: new Date(Date.now() + TOKEN_TTL_MS) } },
    { new: true }
  );
  if (!user) return { sent: false, reason: 'NOT_ELIGIBLE' };
  return dispatchVerification(user, token, tokenHash, actorId, action);
}

async function sendVerificationForUser(user, token, tokenHash, actorId) {
  return dispatchVerification(user, token, tokenHash, actorId, 'email.verification.sent');
}

async function verifyEmail(token) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) throw emailError(400, 'VERIFICATION_TOKEN_INVALID', 'El enlace de verificación no es válido o ya fue utilizado');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = await mongoose.startSession();
  let userId;
  let verifiedUser;
  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({ emailVerificationTokenHash: tokenHash, emailVerified: false })
        .select('+emailVerificationTokenHash +emailVerificationExpiresAt +welcomeEmailAttemptedAt')
        .session(session);
      if (!user) throw emailError(400, 'VERIFICATION_TOKEN_INVALID', 'El enlace de verificación no es válido o ya fue utilizado');
      if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt <= new Date()) {
        throw emailError(400, 'VERIFICATION_TOKEN_EXPIRED', 'El enlace de verificación expiró. Solicita uno nuevo.');
      }
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
      user.emailVerificationTokenHash = null;
      user.emailVerificationExpiresAt = null;
      user.welcomeEmailAttemptedAt = new Date();
      await user.save({ session });
      userId = user.id;
      verifiedUser = { id: user.id, name: user.name, email: user.email };
      await recordAudit({ userId, action: 'email.verified', module: 'auth', recordId: userId, after: { emailVerified: true }, session });
    });
  } finally {
    await session.endSession();
  }

  const welcomeResult = await emailService.sendWelcomeEmail({ user: verifiedUser, idempotencyKey: `welcome-${userId}` });
  if (welcomeResult.sent) {
    try { await User.updateOne({ _id: userId, welcomeEmailSentAt: null }, { $set: { welcomeEmailSentAt: new Date() } }); }
    catch { console.error('No fue posible guardar el estado de envío de bienvenida.'); }
    await safeAudit({ userId, action: 'email.welcome.sent', module: 'auth', recordId: userId, after: { purpose: 'welcome' } });
  } else {
    await safeAudit({ userId, action: 'email.send.failed', module: 'auth', recordId: userId, after: { purpose: 'welcome', reason: welcomeResult.reason || null } });
  }
  return { emailVerified: true };
}

async function resendVerification(email) {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) return;
  const user = await User.findOne({ email: normalized, emailVerified: false, status: 'active' });
  if (!user) return;
  await issueVerification(user.id, null);
}

function emailError(statusCode, errorCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

module.exports = { TOKEN_TTL_MS, createVerificationToken, issueVerification, sendVerificationForUser, verifyEmail, resendVerification };
