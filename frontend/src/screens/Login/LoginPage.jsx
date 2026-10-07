import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api';

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResendMessage('');
    setEmailNotVerified(false);

    const result = await onLogin(form);

    if (!result.success) {
      setError(result.message);
      setEmailNotVerified(result.code === 'EMAIL_NOT_VERIFIED');
      setLoading(false);
      return;
    }

    navigate('/');
  }

  async function handleResend() {
    setResending(true);
    setResendMessage('');
    try {
      const payload = await apiRequest('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email: form.email }) });
      setResendMessage(payload.message);
    } catch (requestError) { setResendMessage(requestError.message || 'No fue posible procesar la solicitud.'); }
    finally { setResending(false); }
  }

  return (
    <main className="login-screen">
      <section className="login-showcase" aria-label="Acerca de YordanUp">
        <a className="login-brand" href="/" aria-label="YordanUp, inicio">
          <img src="/brand/logo-yordanup.png" alt="" />
          <span><strong>YordanUp</strong><small>ERP empresarial</small></span>
        </a>
        <div className="login-showcase-copy">
          <span className="login-kicker">Una operación más clara</span>
          <h1>Tu empresa,<br />en movimiento.</h1>
          <p>Administra las operaciones de tu negocio desde un solo lugar, con información siempre a la mano.</p>
          <div className="login-showcase-note"><span aria-hidden="true">✦</span> Control y visibilidad para cada jornada.</div>
        </div>
        <small className="login-showcase-footer">Gestión simple. Decisiones claras.</small>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel-inner">
          <div className="login-mobile-brand">
            <img src="/brand/logo-yordanup.png" alt="" />
            <span>YordanUp</span>
          </div>
          <div className="auth-header">
            <span className="eyebrow">ERP modular</span>
            <h2 id="login-title">Iniciar sesión</h2>
            <p>Ingresa tus datos para acceder a tu espacio de trabajo.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="login-email">
            Usuario
            <input
              id="login-email"
              type="email"
              name="email"
              autoComplete="username"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="usuario@empresa.com"
              required
            />
          </label>

          <label htmlFor="login-password">
            Contraseña
            <span className="password-field">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Ingresa tu contraseña"
                required
              />
              <button className="password-toggle" type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="21" height="21" fill="none">
                  <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  {showPassword ? (
                    <>
                      <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.8" />
                      <path d="m4 4 16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </>
                  ) : <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.8" />}
                </svg>
              </button>
            </span>
          </label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {resendMessage ? <p role="status">{resendMessage}</p> : null}
          {emailNotVerified ? <button className="login-resend" type="button" onClick={handleResend} disabled={resending || !form.email}>{resending ? 'Enviando...' : 'Reenviar correo de verificación'}</button> : null}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
          <p className="login-help">¿Necesitas ayuda para entrar? Contacta al administrador de tu organización.</p>
        </div>
      </section>
    </main>
  );
}
