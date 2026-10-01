import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerifyEmailPage from './VerifyEmailPage';

afterEach(() => vi.unstubAllGlobals());

function renderPage(path) {
  return render(<MemoryRouter initialEntries={[path]}><VerifyEmailPage /></MemoryRouter>);
}

describe('email verification screen', () => {
  it('confirms a valid token and offers login', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, message: 'ok', data: { emailVerified: true } }) })));
    renderPage('/verify-email?token=valid-token');
    expect(await screen.findByRole('heading', { name: 'Correo confirmado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a iniciar sesión' })).toHaveAttribute('href', '/login');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/verify-email'), expect.objectContaining({ method: 'POST' }));
  });

  it('shows an expired link state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ success: false, message: 'Enlace expirado', error: 'VERIFICATION_TOKEN_EXPIRED' }) })));
    renderPage('/verify-email?token=expired-token');
    expect(await screen.findByRole('heading', { name: 'Enlace expirado' })).toBeInTheDocument();
  });
});
