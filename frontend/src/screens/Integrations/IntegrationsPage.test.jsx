import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IntegrationsPage from './IntegrationsPage';
import WorkspaceLayout from '../../components/WorkspaceLayout';
import { apiRequest } from '../../services/api';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../services/api', () => ({ apiRequest: vi.fn() }));

const item = { id: 'int-1', name: 'WhatsApp Business', slug: 'whatsapp-business', type: 'messaging', description: 'Atención al cliente', owner: 'Soporte', status: 'pending', enabled: false, lastSyncAt: null, lastError: null, config: { region: 'mx' }, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T10:00:00Z' };
const session = permissions => ({ token: 'token', user: { id: 'user-1', permissions } });
const list = data => ({ data, pagination: { page: 1, limit: 25, total: data.length, pages: data.length ? 1 : 0 } });

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation(path => path.startsWith('/api/integrations?') ? Promise.resolve(list([item])) : path === '/api/integrations/int-1' ? Promise.resolve({ data: item }) : Promise.reject(new Error(`Unexpected ${path}`)));
});

describe('IntegrationsPage', () => {
  it('INT-WEB-001 lista datos persistentes con estado y responsable', async () => {
    render(<IntegrationsPage session={session(['integrations.read'])} />);
    expect(await screen.findByText('WhatsApp Business')).toBeInTheDocument();
    expect(screen.getByText('Soporte')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/integrations\?/));
  });
  it('INT-WEB-002 muestra estado vacío y alta según permiso', async () => {
    apiRequest.mockImplementation(() => Promise.resolve(list([])));
    render(<IntegrationsPage session={session(['integrations.read', 'integrations.create'])} />);
    expect(await screen.findByText(/No hay integraciones configuradas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar integración' }));
    expect(screen.getByRole('heading', { name: 'Nueva integración' })).toBeInTheDocument();
  });
  it('INT-WEB-003 crea mediante API y enseña el estado inicial del servidor', async () => {
    apiRequest.mockImplementation((path, options = {}) => path.startsWith('/api/integrations?') ? Promise.resolve(list([item])) : options.method === 'POST' ? Promise.resolve({ data: item }) : Promise.reject(new Error('Unexpected')));
    render(<IntegrationsPage session={session(['integrations.read', 'integrations.create'])} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva integración' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'WhatsApp Business' } });
    fireEvent.change(screen.getByLabelText('Responsable'), { target: { value: 'Soporte' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/integrations', expect.objectContaining({ method: 'POST' })));
    expect(await screen.findByText('Integración creada. Quedó pendiente y deshabilitada.')).toBeInTheDocument();
  });
  it('INT-WEB-004 edita campos permitidos y consulta detalle', async () => {
    apiRequest.mockImplementation((path, options = {}) => options.method === 'PUT' ? Promise.resolve({ data: { ...item, name: 'WhatsApp Business MX' } }) : path === '/api/integrations/int-1' ? Promise.resolve({ data: item }) : path.startsWith('/api/integrations?') ? Promise.resolve(list([item])) : Promise.reject(new Error('Unexpected')));
    render(<IntegrationsPage session={session(['integrations.read', 'integrations.update'])} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/integrations/int-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'WhatsApp Business MX' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/integrations/int-1', expect.objectContaining({ method: 'PUT' })));
    expect(await screen.findByText('Integración actualizada.')).toBeInTheDocument();
  });
  it('INT-WEB-005 habilita/deshabilita con endpoints persistentes', async () => {
    apiRequest.mockImplementation((path, options = {}) => path.startsWith('/api/integrations?') ? Promise.resolve(list([item])) : path === '/api/integrations/int-1/enable' ? Promise.resolve({ data: { ...item, enabled: true } }) : Promise.reject(new Error('Unexpected')));
    render(<IntegrationsPage session={session(['integrations.read', 'integrations.update'])} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/integrations/int-1/enable', { method: 'POST' }));
  });
  it('INT-WEB-006 oculta alta y escritura para solo lectura', async () => {
    render(<IntegrationsPage session={session(['integrations.read'])} />);
    await screen.findByText('WhatsApp Business');
    expect(screen.queryByRole('button', { name: 'Nueva integración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument();
  });
  it('INT-WEB-007 presenta errores del backend', async () => {
    apiRequest.mockRejectedValue(new Error('Backend no disponible'));
    render(<IntegrationsPage session={session(['integrations.read'])} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Backend no disponible');
  });
  it('INT-WEB-008 ya no presenta etiquetas Demo', async () => {
    const auth = session(['integrations.read']);
    render(<MemoryRouter initialEntries={['/integrations']}><Routes><Route element={<WorkspaceLayout session={auth} onLogout={() => {}} />}><Route path="/integrations" element={<IntegrationsPage session={auth} />} /></Route></Routes></MemoryRouter>);
    await screen.findByText('WhatsApp Business');
    expect(screen.getByText('Núcleo persistente')).toBeInTheDocument();
    expect(screen.getByText('Persistente')).toBeInTheDocument();
    expect(screen.queryByText(/Demo|demostrativa|muestra/i)).not.toBeInTheDocument();
  });
});
