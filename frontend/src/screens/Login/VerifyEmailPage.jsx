import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../services/api';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ status: 'checking', message: '' });
  const token = params.get('token');

  useEffect(() => {
    let active = true;
    if (!token) { setState({ status: 'invalid', message: 'El enlace de verificación no es válido.' }); return () => { active = false; }; }
    apiRequest('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => active && setState({ status: 'success', message: 'Tu cuenta quedó verificada. Ya puedes iniciar sesión.' }))
      .catch(error => active && setState({ status: error.code === 'VERIFICATION_TOKEN_EXPIRED' ? 'expired' : 'invalid', message: error.message }))
      .finally(() => { if (active) setState(current => current.status === 'checking' ? { status: 'invalid', message: 'No fue posible verificar el enlace.' } : current); });
    return () => { active = false; };
  }, [token]);

  const title = state.status === 'checking' ? 'Verificando correo…' : state.status === 'success' ? 'Correo confirmado' : state.status === 'expired' ? 'Enlace expirado' : 'No se pudo verificar';
  return <main className="app-shell"><section className="card auth-card"><div className="auth-header"><img className="auth-logo" src="/brand/logo-yordanup.png" alt="Logo YordanUp" /><span className="eyebrow">ERP Modular</span><h2>{title}</h2><p>{state.status === 'checking' ? 'Estamos confirmando tu cuenta.' : state.message}</p>{state.status === 'success' ? <Link className="button-link" to="/login">Ir a iniciar sesión</Link> : state.status !== 'checking' ? <Link to="/login">Volver al inicio de sesión</Link> : null}</div></section></main>;
}
