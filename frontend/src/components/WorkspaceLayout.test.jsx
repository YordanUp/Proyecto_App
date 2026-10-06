import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkspaceLayout from './WorkspaceLayout';
import { apiRequest } from '../services/api';

vi.mock('../services/api', () => ({ apiRequest: vi.fn() }));

test('topbar carga el contador de notificaciones al entrar y muestra badge', async () => {
  apiRequest.mockResolvedValue({ data: { count: 3 } });
  render(<MemoryRouter initialEntries={['/']}><WorkspaceLayout session={{ token: 'token', user: { name: 'Test', permissions: ['dashboard.read', 'notifications.read'] } }} /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'Notificaciones, 3 sin leer' })).toBeInTheDocument();
  expect(apiRequest).toHaveBeenCalledWith('/api/notifications/unread-count');
});

test('settings dejó de presentarse como una vista demo', () => {
  render(<MemoryRouter initialEntries={['/settings']}><WorkspaceLayout session={{ token: 'token', user: { name: 'Test', permissions: ['settings.read'] } }} /></MemoryRouter>);
  expect(screen.getByText('Preferencias persistentes del sistema.')).toBeInTheDocument();
  expect(screen.getByText('Núcleo persistente')).toBeInTheDocument();
  expect(screen.queryByText('Vista demostrativa.')).not.toBeInTheDocument();
  expect(screen.queryByText('Datos de muestra')).not.toBeInTheDocument();
});
