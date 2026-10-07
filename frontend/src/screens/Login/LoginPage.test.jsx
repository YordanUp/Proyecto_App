import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ apiRequest: vi.fn() }));

function renderLogin(onLogin) {
  return render(<MemoryRouter><LoginPage onLogin={onLogin} /></MemoryRouter>);
}

beforeEach(() => apiRequest.mockReset());

describe('LoginPage invitation flow', () => {
  it('UI-WEB-001: presenta formulario accesible y permite mostrar u ocultar la contraseña', () => {
    renderLogin(vi.fn());
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario')).toHaveAttribute('autocomplete', 'username');
    const password = screen.getByLabelText('Contraseña');
    expect(password).toHaveAttribute('type', 'password');
    const showButton = screen.getByRole('button', { name: 'Mostrar contraseña' });
    expect(showButton).toHaveAttribute('type', 'button');
    expect(showButton.querySelector('svg')).toBeInTheDocument();
    fireEvent.click(showButton);
    expect(password).toHaveAttribute('type', 'text');
    const hideButton = screen.getByRole('button', { name: 'Ocultar contraseña' });
    expect(hideButton).toHaveAttribute('type', 'button');
    fireEvent.click(hideButton);
    expect(password).toHaveAttribute('type', 'password');
  });

  it('UI-WEB-002: muestra estado de carga y bloquea envíos repetidos', async () => {
    let resolveLogin;
    const onLogin = vi.fn(() => new Promise((resolve) => { resolveLogin = resolve; }));
    renderLogin(onLogin);
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(screen.getByRole('button', { name: 'Ingresando...' })).toBeDisabled();
    resolveLogin({ success: false, message: 'No se pudo iniciar sesión.' });
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo iniciar sesión.');
  });

  it('UI-WEB-003: anuncia el error general como alerta accesible', async () => {
    const onLogin = vi.fn().mockResolvedValue({ success: false, message: 'Credenciales incorrectas.' });
    renderLogin(onLogin);
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales incorrectas.');
  });

  it('USR-UI-009: presenta el mensaje específico si falta verificar el correo', async () => {
    const onLogin = vi.fn().mockResolvedValue({ success: false, code: 'EMAIL_NOT_VERIFIED', message: 'Debes confirmar tu correo antes de iniciar sesión.' });
    renderLogin(onLogin);
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password-temporal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Debes confirmar tu correo antes de iniciar sesión.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar correo de verificación' })).toBeInTheDocument();
    expect(screen.queryByText(/crear cuenta|registrarse|sign up/i)).not.toBeInTheDocument();
  });

  it('reutiliza el email del login para pedir el reenvío genérico', async () => {
    const onLogin = vi.fn().mockResolvedValue({ success: false, code: 'EMAIL_NOT_VERIFIED', message: 'Debes confirmar tu correo antes de iniciar sesión.' });
    apiRequest.mockResolvedValue({ message: 'Si la cuenta existe y requiere verificación, se enviará un correo.', data: {} });
    renderLogin(onLogin);
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password-temporal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar correo de verificación' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Si la cuenta existe y requiere verificación');
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/auth/resend-verification', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'ana@example.com' }) })));
  });
});
