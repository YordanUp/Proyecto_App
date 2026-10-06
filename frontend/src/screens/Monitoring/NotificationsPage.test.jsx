import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationsPage from './NotificationsPage';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ apiRequest: vi.fn() }));

const first = { id: 'notification-1', title: 'Stock bajo', message: 'Quedan pocas unidades', type: 'inventory.low_stock', module: 'inventory', status: 'unread', priority: 'high', createdAt: '2026-10-01T10:00:00Z', readAt: null };
const second = { ...first, id: 'notification-2', title: 'Venta confirmada', type: 'sales.confirmed', module: 'sales' };
const session = { token: 'token', user: { id: 'user-1', permissions: ['notifications.read'] } };

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation(path => {
    if (path.includes('unread-count')) return Promise.resolve({ data: { count: 2 } });
    if (path.startsWith('/api/notifications?')) return Promise.resolve({ data: [first, second], pagination: { page: 1, pages: 1, total: 2 } });
    if (path.endsWith('/read')) return Promise.resolve({ data: { ...first, status: 'read', readAt: '2026-10-02T10:00:00Z' } });
    if (path.endsWith('/read-all')) return Promise.resolve({ data: { modifiedCount: 2 } });
    return Promise.reject(new Error('Unexpected request'));
  });
});

describe('NotificationsPage', () => {
  it('NOT-WEB-001/002 muestra bandeja persistente y contador', async () => {
    render(<NotificationsPage session={session} />);
    expect(await screen.findByText('Stock bajo')).toBeInTheDocument();
    expect(screen.getByText('2 sin leer')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/notifications\?/));
    expect(apiRequest).toHaveBeenCalledWith('/api/notifications/unread-count');
  });
  it('NOT-WEB-003 filtra no leídas consultando API', async () => {
    render(<NotificationsPage session={session} />); await screen.findByText('Stock bajo');
    fireEvent.click(screen.getByRole('button', { name: 'No leídas' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('status=unread')));
  });
  it('NOT-WEB-004 marca una como leída y actualiza el contador', async () => {
    render(<NotificationsPage session={session} />); await screen.findByText('Stock bajo');
    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar como leída' })[0]);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/notifications/notification-1/read', { method: 'POST' }));
    expect(await screen.findByText('1 sin leer')).toBeInTheDocument();
  });
  it('NOT-WEB-005 marca todas como leídas sin recargar la aplicación', async () => {
    render(<NotificationsPage session={session} />); await screen.findByText('Stock bajo');
    fireEvent.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/notifications/read-all', { method: 'POST' }));
    expect(await screen.findByText('0 sin leer')).toBeInTheDocument();
  });
  it('NOT-WEB-007 presenta los errores del backend', async () => {
    apiRequest.mockRejectedValue(new Error('No se pudo cargar la bandeja'));
    render(<NotificationsPage session={session} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar la bandeja');
  });
});
