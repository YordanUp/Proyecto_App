import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import UsersPage from './UsersPage';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ apiRequest: vi.fn() }));

const roles = [{ id: 'role-1', name: 'ventas', description: 'Ventas', isSystem: true }, { id: 'custom-role', name: 'operator', description: 'Operador', isSystem: false }];
const makeSession = permissions => ({ token: 'test-token', user: { id: 'admin-1', permissions } });
const user = { id: 'user-1', name: 'Ana Pérez', email: 'ana@example.com', role: 'ventas', status: 'active', emailVerified: false, permissions: ['products.read'] };
const createPermissions = ['users.read', 'users.create', 'users.assign_role', 'roles.read'];

function mockInitialLoad(users = []) {
  apiRequest.mockImplementation(path => {
    if (path.startsWith('/api/users')) return Promise.resolve({ data: users });
    if (path === '/api/roles') return Promise.resolve({ data: roles });
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
}

beforeEach(() => { apiRequest.mockReset(); });

describe('UsersPage user management', () => {
  it('USR-UI-001: muestra Nuevo usuario a quien tiene users.create', async () => {
    mockInitialLoad();
    render(<UsersPage session={makeSession(createPermissions)} />);
    expect(await screen.findByRole('button', { name: /nuevo usuario/i })).toBeInTheDocument();
  });

  it('USR-UI-002: oculta Nuevo usuario sin users.create', async () => {
    mockInitialLoad();
    render(<UsersPage session={makeSession(['users.read'])} />);
    await screen.findByText('No hay usuarios para mostrar.');
    expect(screen.queryByRole('button', { name: /nuevo usuario/i })).not.toBeInTheDocument();
  });

  it('USR-UI-003: valida nombre y email requeridos/formato', async () => {
    mockInitialLoad();
    render(<UsersPage session={makeSession(createPermissions)} />);
    fireEvent.click(await screen.findByRole('button', { name: /nuevo usuario/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'email-invalido' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('El nombre debe tener al menos 2 caracteres.');
    expect(apiRequest).not.toHaveBeenCalledWith('/api/users', expect.objectContaining({ method: 'POST' }));
    fireEvent.change(within(dialog).getByLabelText('Nombre completo'), { target: { value: 'Usuario Nuevo' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Ingresa un email válido.');
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'nuevo@example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Contraseña temporal'), { target: { value: 'password-valida-123' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Selecciona un rol.');
  });

  it('USR-UI-004: rechaza contraseña temporal menor a 12 caracteres', async () => {
    mockInitialLoad();
    render(<UsersPage session={makeSession(createPermissions)} />);
    fireEvent.click(await screen.findByRole('button', { name: /nuevo usuario/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre completo'), { target: { value: 'Nuevo Usuario' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'nuevo@example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Contraseña temporal'), { target: { value: 'corta' } });
    fireEvent.change(within(dialog).getByLabelText('Rol'), { target: { value: 'role-1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('La contraseña temporal debe tener al menos 12 caracteres.');
    expect(apiRequest).not.toHaveBeenCalledWith('/api/users', expect.objectContaining({ method: 'POST' }));
  });

  it('USR-UI-005: carga los roles desde el endpoint real', async () => {
    mockInitialLoad();
    render(<UsersPage session={makeSession(createPermissions)} />);
    fireEvent.click(await screen.findByRole('button', { name: /nuevo usuario/i }));
    expect(await within(screen.getByRole('dialog')).findByRole('option', { name: 'Ventas' })).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/api/roles');
  });

  it('USR-UI-006: crea el usuario y recarga el listado', async () => {
    let created = false;
    apiRequest.mockImplementation((path, options = {}) => {
      if (path.startsWith('/api/users') && options.method === 'POST') { created = true; return Promise.resolve({ data: { ...user, emailVerification: 'sent' } }); }
      if (path.startsWith('/api/users')) return Promise.resolve({ data: created ? [{ ...user, emailVerified: false }] : [] });
      if (path === '/api/roles') return Promise.resolve({ data: roles });
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    render(<UsersPage session={makeSession(createPermissions)} />);
    fireEvent.click(await screen.findByRole('button', { name: /nuevo usuario/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre completo'), { target: { value: 'Ana Pérez' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'ana@example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Contraseña temporal'), { target: { value: 'una-clave-segura-123' } });
    fireEvent.change(within(dialog).getByLabelText('Rol'), { target: { value: 'role-1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/api/users', expect.objectContaining({ method: 'POST', body: expect.stringContaining('una-clave-segura-123') }));
    expect(await screen.findByText(/Se envió un correo de confirmación/i)).toBeInTheDocument();
  });

  it('USR-UI-007: informa que el correo de verificación se envió', async () => {
    mockInitialLoad();
    apiRequest.mockImplementation((path, options = {}) => path === '/api/roles' ? Promise.resolve({ data: roles })
      : options.method === 'POST' ? Promise.resolve({ data: { emailVerification: 'sent' } })
        : Promise.resolve({ data: [] }));
    render(<UsersPage session={makeSession(createPermissions)} />);
    fireEvent.click(await screen.findByRole('button', { name: /nuevo usuario/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre completo'), { target: { value: 'Nuevo Usuario' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'nuevo@example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Contraseña temporal'), { target: { value: 'clave-temporal-valida' } });
    fireEvent.change(within(dialog).getByLabelText('Rol'), { target: { value: 'role-1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));
    expect(await screen.findByText('Usuario creado correctamente. Se envió un correo de confirmación.')).toBeInTheDocument();
  });

  it('USR-UI-008: informa de forma diferenciada si el email queda pendiente', async () => {
    mockInitialLoad();
    apiRequest.mockImplementation((path, options = {}) => path === '/api/roles' ? Promise.resolve({ data: roles })
      : options.method === 'POST' ? Promise.resolve({ data: { emailVerification: 'pending' } })
        : Promise.resolve({ data: [] }));
    render(<UsersPage session={makeSession(createPermissions)} />);
    fireEvent.click(await screen.findByRole('button', { name: /nuevo usuario/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre completo'), { target: { value: 'Nuevo Usuario' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'nuevo@example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Contraseña temporal'), { target: { value: 'clave-temporal-valida' } });
    fireEvent.change(within(dialog).getByLabelText('Rol'), { target: { value: 'role-1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));
    expect(await screen.findByText('Usuario creado correctamente, pero el correo de confirmación no pudo enviarse.')).toBeInTheDocument();
  });

  it('USR-UI-010: reenvía verificación a cuentas pendientes', async () => {
    mockInitialLoad([user]);
    apiRequest.mockImplementation((path, options = {}) => {
      if (path.startsWith('/api/users')) return Promise.resolve({ data: [user] });
      if (path === '/api/auth/resend-verification') return Promise.resolve({ message: 'Si la cuenta existe y requiere verificación, se enviará un correo.', data: {} });
      return Promise.resolve({ data: roles });
    });
    render(<UsersPage session={makeSession(['users.read'])} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar verificación' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Si la cuenta existe y requiere verificación');
    expect(apiRequest).toHaveBeenCalledWith('/api/auth/resend-verification', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: user.email }) }));
  });

  it('solo habilita edición, estado y asignación de rol con los permisos requeridos', async () => {
    mockInitialLoad([user]);
    const { rerender } = render(<UsersPage session={makeSession(['users.read', 'users.update'])} />);
    await screen.findByText('Ana Pérez');
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Rol de Ana Pérez' })).not.toBeInTheDocument();

    rerender(<UsersPage session={makeSession(['users.read', 'users.update', 'users.assign_role', 'roles.read'])} />);
    expect(await screen.findByRole('combobox', { name: 'Rol de Ana Pérez' })).toBeInTheDocument();
  });

  it('USR-UI-011: ofrece roles base y excluye roles personalizados al asignar', async () => {
    mockInitialLoad([user]);
    render(<UsersPage session={makeSession(['users.read', 'users.update', 'users.assign_role', 'roles.read'])} />);
    const roleSelect = await screen.findByRole('combobox', { name: 'Rol de Ana Pérez' });
    expect(within(roleSelect).getByRole('option', { name: 'Ventas' })).toBeInTheDocument();
    expect(within(roleSelect).queryByRole('option', { name: 'Operador' })).not.toBeInTheDocument();
  });
});
