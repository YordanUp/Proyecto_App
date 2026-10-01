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
    <div className="app-shell">
      <div className="card auth-card">
        <div className="auth-header">
          <img className="auth-logo" src="/brand/logo-yordanup.png" alt="Logo YordanUp" />
          <span className="eyebrow">ERP Modular</span>
          <h2>Iniciar sesión</h2>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Usuario
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="usuario@empresa.com"
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="••••••••"
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          {resendMessage ? <p role="status">{resendMessage}</p> : null}
          {emailNotVerified ? <button type="button" onClick={handleResend} disabled={resending || !form.email}>{resending ? 'Enviando...' : 'Reenviar correo de verificación'}</button> : null}

          <button type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
