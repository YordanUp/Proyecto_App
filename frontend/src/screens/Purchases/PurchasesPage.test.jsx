import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PurchasesPage from './PurchasesPage';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ apiRequest: vi.fn() }));

const supplier = { id: 'supplier-1', name: 'Proveedor Uno', email: 'proveedor@example.test' };
const product = { id: 'product-1', code: 'P-1', name: 'Producto Uno', purchasePrice: 12, salePrice: 20, status: 'active' };
const warehouse = { id: 'warehouse-1', name: 'Almacén Central' };
const purchase = { id: 'purchase-1', folio: 'COM-2026-000001', supplierId: supplier.id, supplier, items: [], subtotal: 24, taxes: 0, total: 24, status: 'ordered', createdAt: '2026-01-01T12:00:00.000Z' };
const session = { token: 'token', user: { id: 'user-1', permissions: ['purchases.read', 'purchases.create', 'purchases.update', 'purchases.approve', 'purchases.receive', 'purchases.cancel'] } };

beforeEach(() => apiRequest.mockReset());

function setupApi({ receiveError = null } = {}) {
  apiRequest.mockImplementation((path, options = {}) => {
    if (typeof path !== 'string') return Promise.resolve({ data: [] });
    if (path.startsWith('/api/purchases?')) return Promise.resolve({ data: [purchase], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
    if (path === '/api/suppliers?status=active&page=1&limit=100&sort=name&order=asc') return Promise.resolve({ data: [supplier] });
    if (path === '/api/products?status=active&page=1&limit=100&sort=name&order=asc') return Promise.resolve({ data: [product] });
    if (path === '/api/inventory/warehouses') return Promise.resolve({ data: [warehouse] });
    if (path === '/api/purchases' && options.method === 'POST') return Promise.resolve({ message: 'Borrador creado', data: { ...purchase, status: 'draft', folio: 'COM-2026-000002' } });
    if (path === `/api/purchases/${purchase.id}/receive`) return receiveError ? Promise.reject(new Error(receiveError)) : Promise.resolve({ message: 'Compra recibida correctamente', data: { ...purchase, status: 'received' } });
    if (path === `/api/purchases/${purchase.id}`) return Promise.resolve({ data: purchase });
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
}

describe('PurchasesPage', () => {
  it('consulta compras persistentes y muestra acciones según permisos/estado', async () => {
    setupApi();
    render(<PurchasesPage session={session} />);
    expect(await screen.findByText('COM-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('Proveedor Uno')).toBeInTheDocument();
    expect(screen.getAllByText('Ordenada').length).toBeGreaterThan(0);
    expect(apiRequest).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/purchases\?/));
    expect(screen.getByRole('button', { name: 'Recibir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('crea borrador con catálogos reales y envía costos y partidas al backend', async () => {
    setupApi();
    render(<PurchasesPage session={session} />);
    fireEvent.click(await screen.findByRole('button', { name: '+ Nueva compra' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('option', { name: /Producto Uno/ });
    fireEvent.change(within(dialog).getByLabelText('Proveedor'), { target: { value: supplier.id } });
    fireEvent.change(within(dialog).getByLabelText('Producto'), { target: { value: product.id } });
    fireEvent.change(within(dialog).getByLabelText('Almacén'), { target: { value: warehouse.id } });
    fireEvent.change(within(dialog).getByLabelText('Cantidad partida 1'), { target: { value: '2' } });
    fireEvent.change(within(dialog).getByLabelText('Impuesto partida 1'), { target: { value: '16' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear borrador' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/purchases', expect.objectContaining({ method: 'POST' })));
    const post = apiRequest.mock.calls.find(([path, options]) => path === '/api/purchases' && options?.method === 'POST');
    expect(JSON.parse(post[1].body)).toEqual({ supplierId: supplier.id, items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 2, unitCost: 12, taxRate: 16 }] });
    expect(await screen.findByRole('status')).toHaveTextContent('Borrador COM-2026-000002 creado.');
  });

  it('confirma antes de recibir y muestra errores devueltos por la API', async () => {
    setupApi({ receiveError: 'La compra ya fue recibida' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PurchasesPage session={session} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Recibir' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('se registrarán movimientos'));
    expect(await screen.findByRole('alert')).toHaveTextContent('La compra ya fue recibida');
    vi.restoreAllMocks();
  });

  it('no permite al usuario sin purchases.read ver operaciones', async () => {
    render(<PurchasesPage session={{ ...session, user: { ...session.user, permissions: [] } }} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para consultar compras');
    expect(screen.queryByRole('button', { name: '+ Nueva compra' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recibir' })).not.toBeInTheDocument();
  });
});
