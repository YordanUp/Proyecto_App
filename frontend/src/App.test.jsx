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

const adminPermissions = ['dashboard.read', 'products.read', 'products.create', 'products.update', 'inventory.read', 'sales.read', 'purchases.read', 'finance.read', 'reports.read', 'users.read', 'roles.read', 'clients.read', 'suppliers.read', 'categories.read', 'warehouses.read', 'settings.read', 'notifications.read', 'integrations.read', 'audit.read'];
function authenticate(permissions = adminPermissions) {
  localStorage.setItem('erp_token', String('fake-token'));
  localStorage.setItem('erp_user', JSON.stringify({ id: 'test-user', name: 'Test User', permissions }));
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
    authenticate();
    renderWithRouter(['/']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /dashboard ERP/i })).toBeInTheDocument();
    });
  });

  it('allows access to the products route when authenticated', async () => {
    authenticate();
    renderWithRouter(['/products']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /productos/i })).toBeInTheDocument();
    });
  });

  it('allows access to the inventory route when authenticated', async () => {
    authenticate();
    renderWithRouter(['/inventory']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /stock y almacenes/i })).toBeInTheDocument();
    });
  });

  it('allows access to the sales route when authenticated', async () => {
    authenticate();
    renderWithRouter(['/sales']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /ventas persistentes/i })).toBeInTheDocument();
    });
  });

  it('allows access to the purchases route when authenticated', async () => {
    authenticate();
    renderWithRouter(['/purchases']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /órdenes y compras/i })).toBeInTheDocument();
    });
  });

  it('allows access to the finance route when authenticated', async () => {
    authenticate();
    renderWithRouter(['/finance']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /cuentas y pagos/i })).toBeInTheDocument();
    });
  });

  it('allows access to the reports route when authenticated', async () => {
    authenticate();
    renderWithRouter(['/reports']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /reportes y auditoría/i })).toBeInTheDocument();
    });
  });

  it('allows access to the users route when authenticated', async () => {
    authenticate();
    renderWithRouter(['/users']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /usuarios y permisos/i })).toBeInTheDocument();
    });
  });

  it('allows access to the roles route when authenticated', async () => {
    authenticate();
    renderWithRouter(['/roles']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /roles y permisos/i })).toBeInTheDocument();
    });
  });

  it('allows access to the clients route when authenticated', async () => {
    authenticate();
    renderWithRouter(['/clients']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /clientes y proveedores/i })).toBeInTheDocument();
    });
  });

  it('allows access to the categories route when authenticated', async () => {
    authenticate();
    renderWithRouter(['/categories']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /categorías/i })).toBeInTheDocument();
    });
  });

  it('allows access to the settings route when authenticated', async () => {
    authenticate();
    renderWithRouter(['/settings']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /configuración del sistema/i })).toBeInTheDocument();
    });
  });

  it('allows access to the notifications route when authenticated', async () => {
    authenticate();
    renderWithRouter(['/notifications']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /notificaciones del sistema/i })).toBeInTheDocument();
    });
  });

  it('blocks notifications for users without notifications.read', async () => {
    authenticate(['dashboard.read']);
    renderWithRouter(['/notifications']);
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso');
    expect(screen.queryByRole('link', { name: /notificaciones/i })).not.toBeInTheDocument();
  });

  it('allows access to the audit route when authenticated', async () => {
    authenticate();
    renderWithRouter(['/audit']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /auditoría del sistema/i })).toBeInTheDocument();
    });
  });

  it('allows access to the integrations route when authenticated', async () => {
    authenticate();
    renderWithRouter(['/integrations']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /integraciones del sistema/i })).toBeInTheDocument();
    });
  });

  it('WEB-RBAC-001: ventas ve sus módulos sin Administración, Finanzas o Compras', async () => {
    authenticate(['dashboard.read', 'sales.read', 'products.read', 'clients.read', 'categories.read', 'inventory.read', 'reports.read']);
    renderWithRouter(['/']);
    expect(await screen.findByRole('heading', { name: /dashboard ERP/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ventas' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /usuarios/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Finanzas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Compras' })).not.toBeInTheDocument();
  });

  it('WEB-RBAC-002: bloquea la ruta directa de Finanzas sin finance.read', async () => {
    authenticate(['dashboard.read', 'sales.read']);
    renderWithRouter(['/finance']);
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para acceder a este módulo.');
  });
});
