import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RolesPage from './RolesPage';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ apiRequest: vi.fn() }));

beforeEach(() => { apiRequest.mockReset(); });

it('ROLE-UI-001: muestra descripción, conteo y permisos agrupados que llegan del backend', async () => {
  apiRequest.mockResolvedValue({ data: [
    { id: 'admin', name: 'admin', description: 'Administrador', isSystem: true, permissions: ['users.read', 'sales.read', 'finance.read'] },
    { id: 'sales', name: 'ventas', description: 'Ventas', isSystem: true, permissions: ['sales.read'] }
  ] });
  render(<RolesPage session={{ token: 'token' }} />);
  expect(await screen.findByText('Administrador')).toBeInTheDocument();
  expect(screen.getAllByText('Sistema')).toHaveLength(2);
  fireEvent.click(screen.getByText('3 permisos'));
  expect(screen.getAllByText('sales.read')).toHaveLength(2);
  expect(screen.getByText('users.read')).toBeInTheDocument();
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/roles', { token: 'token' }));
});
