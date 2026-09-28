import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'admin@erp.local', password: 'admin123' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const result = await onLogin(form);
    if (!result.success) {
      setError(result.message);
      setLoading(false);
      return;
    }
    navigate('/');
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <img src="/assets/upti-erp-logo.webp" alt="Logo del ERP" />
        <div><strong>ERP Modular</strong><span>Management System</span></div>
      </div>
      <div className="card auth-card">
        <div className="auth-header">
          <span className="eyebrow">Acceso al sistema</span>
          <h2>Iniciar sesión</h2>
          <p>Ingresa tus credenciales para acceder al panel administrativo.</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>Correo electrónico
            <input type="email" name="email" value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="usuario@empresa.com" required />
          </label>
          <label>Contraseña
            <input type="password" name="password" value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="••••••••" required />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar al ERP'}</button>
        </form>
      </div>
    </div>
  );
}
