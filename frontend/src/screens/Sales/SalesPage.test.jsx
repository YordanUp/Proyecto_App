import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SalesPage from './SalesPage';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ apiRequest: vi.fn() }));

const client = { id: 'client-1', name: 'Cliente Uno', email: 'cliente@example.test' };
const product = { id: 'product-1', code: 'P-1', name: 'Producto Uno', purchasePrice: 5, salePrice: 10, status: 'active' };
const warehouse = { id: 'warehouse-1', name: 'Almacén Central' };
const sale = { id: 'sale-1', folio: 'VEN-2026-000001', customerId: client.id, customer: client, items: [], subtotal: 20, taxes: 0, total: 20, status: 'draft', createdAt: '2026-01-01T12:00:00.000Z' };
const session = { token: 'token', user: { id: 'user-1', permissions: ['sales.read', 'sales.create', 'sales.update', 'sales.cancel'] } };

beforeEach(() => apiRequest.mockReset());

function setupApi({ confirmError = null } = {}) {
  apiRequest.mockImplementation((path, options = {}) => {
    if (typeof path !== 'string') return Promise.resolve({ data: [] });
    if (path.startsWith('/api/sales?')) return Promise.resolve({ data: [sale], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
    if (path === '/api/clients?status=active&page=1&limit=100&sort=name&order=asc') return Promise.resolve({ data: [client] });
    if (path === '/api/products?status=active&page=1&limit=100&sort=name&order=asc') return Promise.resolve({ data: [product] });
    if (path === '/api/inventory/warehouses') return Promise.resolve({ data: [warehouse] });
    if (path === '/api/sales' && options.method === 'POST') return Promise.resolve({ message: 'Borrador creado', data: { ...sale, folio: 'VEN-2026-000002' } });
    if (path === `/api/sales/${sale.id}/confirm`) return confirmError ? Promise.reject(new Error(confirmError)) : Promise.resolve({ data: { ...sale, status: 'confirmed' } });
    if (path === `/api/sales/${sale.id}/cancel`) return Promise.resolve({ data: { ...sale, status: 'cancelled' } });
    if (path === `/api/sales/${sale.id}`) return Promise.resolve({ data: sale });
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
}

describe('SalesPage', () => {
  it('consulta ventas persistentes y muestra estados y acciones de acuerdo con permisos', async () => {
    setupApi();
    render(<SalesPage session={session} />);
    expect(await screen.findByText('VEN-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('Cliente Uno')).toBeInTheDocument();
    expect(screen.getAllByText('Borrador').length).toBeGreaterThan(0);
    expect(apiRequest).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/sales\?/));
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('crea un borrador usando catálogos reales y deja que backend calcule el folio y totales', async () => {
    setupApi();
    render(<SalesPage session={session} />);
    fireEvent.click(await screen.findByRole('button', { name: '+ Nueva venta' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('option', { name: /Producto Uno/ });
    fireEvent.change(within(dialog).getByLabelText('Cliente'), { target: { value: client.id } });
    fireEvent.change(within(dialog).getByLabelText('Producto'), { target: { value: product.id } });
    fireEvent.change(within(dialog).getByLabelText('Almacén'), { target: { value: warehouse.id } });
    fireEvent.change(within(dialog).getByLabelText('Cantidad partida 1'), { target: { value: '2' } });
    fireEvent.change(within(dialog).getByLabelText('Impuesto partida 1'), { target: { value: '16' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear borrador' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/sales', expect.objectContaining({ method: 'POST' })));
    const postCall = apiRequest.mock.calls.find(([path, options]) => path === '/api/sales' && options?.method === 'POST');
    expect(JSON.parse(postCall[1].body)).toEqual({ customerId: client.id, items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 2, unitPrice: 10, taxRate: 16 }] });
    expect(await screen.findByRole('status')).toHaveTextContent('Borrador VEN-2026-000002 creado.');
  });

  it('pide confirmación antes de confirmar y comunica el error de stock del servidor', async () => {
    setupApi({ confirmError: 'Stock insuficiente para VEN-2026-000001' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SalesPage session={session} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Se descontará inventario'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Stock insuficiente');
    vi.restoreAllMocks();
  });

  it('no muestra operaciones a quien carece de sales.read y no oculta el 403', async () => {
    render(<SalesPage session={{ ...session, user: { ...session.user, permissions: [] } }} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para consultar ventas');
    expect(screen.queryByRole('button', { name: '+ Nueva venta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
  });
});
