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
