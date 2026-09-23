import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

function renderWithRouter(initialEntries) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>
  );
}

describe('App routing and auth flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirects unauthenticated users to login', async () => {
    renderWithRouter(['/']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    });
  });

  it('shows dashboard when a valid token exists', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /dashboard ERP/i })).toBeInTheDocument();
    });
  });

  it('allows access to the products route when authenticated', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/products']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /productos/i })).toBeInTheDocument();
    });
  });

  it('allows access to the inventory route when authenticated', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/inventory']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /stock y almacenes/i })).toBeInTheDocument();
    });
  });

  it('allows access to the sales route when authenticated', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/sales']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /cotizaciones y ventas/i })).toBeInTheDocument();
    });
  });

  it('allows access to the purchases route when authenticated', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/purchases']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /órdenes y compras/i })).toBeInTheDocument();
    });
  });

  it('allows access to the finance route when authenticated', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/finance']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /cuentas y pagos/i })).toBeInTheDocument();
    });
  });

  it('allows access to the reports route when authenticated', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/reports']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /reportes y auditoría/i })).toBeInTheDocument();
    });
  });

  it('allows access to the users route when authenticated', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/users']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /usuarios y permisos/i })).toBeInTheDocument();
    });
  });

  it('allows access to the roles route when authenticated', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/roles']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /roles y permisos/i })).toBeInTheDocument();
    });
  });

  it('allows access to the clients route when authenticated', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/clients']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /clientes y proveedores/i })).toBeInTheDocument();
    });
  });

  it('allows access to the categories route when authenticated', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/categories']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /categorías/i })).toBeInTheDocument();
    });
  });

  it('allows access to the settings route when authenticated', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/settings']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /configuración del sistema/i })).toBeInTheDocument();
    });
  });

  it('allows access to the notifications route when authenticated', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/notifications']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /notificaciones del sistema/i })).toBeInTheDocument();
    });
  });

  it('allows access to the audit route when authenticated', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/audit']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /auditoría del sistema/i })).toBeInTheDocument();
    });
  });

  it('allows access to the integrations route when authenticated', async () => {
    localStorage.setItem('erp_token', 'fake-token');
    renderWithRouter(['/integrations']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /integraciones del sistema/i })).toBeInTheDocument();
    });
  });
});
