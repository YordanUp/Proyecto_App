import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InventoryPage from './InventoryPage';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ apiRequest: vi.fn() }));

const warehouse = { id: 'warehouse-1', name: 'Almacén Central', status: 'active' };
const product = { id: 'product-1', code: 'P-1', name: 'Producto uno', status: 'active' };
const stock = { id: 'stock-1', productId: product.id, product: { id: product.id, code: product.code, name: product.name }, warehouseId: warehouse.id, warehouse, quantity: 7, reservedQuantity: 1, availableQuantity: 6, minimumStock: 2, status: 'available' };
const movement = { id: 'movement-1', productId: product.id, product: { id: product.id, name: product.name }, warehouseId: warehouse.id, warehouse, type: 'IN', quantity: 7, previousQuantity: 0, newQuantity: 7, reason: 'Recepción', userId: 'user-1', user: { id: 'user-1', name: 'Admin' }, createdAt: '2026-01-01T12:00:00.000Z' };
const permissions = ['inventory.read', 'inventory.create', 'inventory.adjust'];
const session = { token: 'token', user: { id: 'user-1', permissions } };

function setupApi(warehouses = [warehouse]) {
  apiRequest.mockImplementation(path => {
    if (typeof path !== 'string') return Promise.resolve({ data: [] });
    if (path.startsWith('/api/inventory/movements')) return Promise.resolve({ data: [movement], pagination: { page: 1, limit: 25, total: 1, pages: 1 } });
    if (path.startsWith('/api/inventory?')) return Promise.resolve({ data: [stock], pagination: { page: 1, limit: 25, total: 1, pages: 1 } });
    if (path === '/api/inventory/warehouses') return Promise.resolve({ data: warehouses });
    if (path.startsWith('/api/products?')) return Promise.resolve({ data: [product] });
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
}

beforeEach(() => apiRequest.mockReset());

describe('InventoryPage', () => {
  it('consulta y muestra existencias y movimientos desde la API real', async () => {
    setupApi();
    render(<InventoryPage session={session} />);
    expect((await screen.findAllByText('Producto uno')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Almacén Central').length).toBeGreaterThan(0);
    expect(screen.getByText('Recepción')).toBeInTheDocument();
    expect(screen.getAllByText('Disponible').length).toBeGreaterThan(0);
    expect(apiRequest).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/inventory\?/));
    expect(apiRequest).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/inventory\/movements\?/));
  });

  it('oculta las operaciones de escritura cuando el usuario no tiene permisos', async () => {
    setupApi();
    render(<InventoryPage session={{ ...session, user: { ...session.user, permissions: ['inventory.read'] } }} />);
    await screen.findAllByText('Producto uno');
    expect(screen.queryByRole('button', { name: /entrada/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /salida/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ajustar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /transferir/i })).not.toBeInTheDocument();
  });

  it('registra una entrada, no toma el actor del formulario y recarga existencias', async () => {
    let entered = false;
    apiRequest.mockImplementation((path, options = {}) => {
      if (typeof path !== 'string') return Promise.resolve({ data: [] });
      if (path === '/api/inventory/entry' && options.method === 'POST') { entered = true; return Promise.resolve({ message: 'Entrada registrada', data: {} }); }
      if (path.startsWith('/api/inventory/movements')) return Promise.resolve({ data: [movement], pagination: { page: 1, limit: 25, total: 1, pages: 1 } });
      if (path.startsWith('/api/inventory?')) return Promise.resolve({ data: [entered ? { ...stock, quantity: 9 } : stock], pagination: { page: 1, limit: 25, total: 1, pages: 1 } });
      if (path === '/api/inventory/warehouses') return Promise.resolve({ data: [warehouse] });
      if (path.startsWith('/api/products?')) return Promise.resolve({ data: [product] });
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    render(<InventoryPage session={session} />);
    fireEvent.click(await screen.findByRole('button', { name: '+ Entrada' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Producto'), { target: { value: product.id } });
    fireEvent.change(within(dialog).getByLabelText('Almacén'), { target: { value: warehouse.id } });
    fireEvent.change(within(dialog).getByLabelText('Cantidad'), { target: { value: '2' } });
    fireEvent.change(within(dialog).getByLabelText('Motivo'), { target: { value: 'Recepción validada' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar operación' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Entrada registrada');
    await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument());
    expect(apiRequest).toHaveBeenCalledWith('/api/inventory/entry', expect.objectContaining({ method: 'POST', body: JSON.stringify({ productId: product.id, warehouseId: warehouse.id, quantity: 2, reason: 'Recepción validada', referenceType: 'manual', referenceId: '' }) }));
  });

  it('envía transferencias al endpoint transaccional existente y muestra errores de negocio', async () => {
    const destination = { id: 'warehouse-2', name: 'Almacén Norte', status: 'active' };
    setupApi([warehouse, destination]);
    apiRequest.mockImplementation((path, options = {}) => {
      if (typeof path !== 'string') return Promise.resolve({ data: [] });
      if (path === '/api/inventory/transfer' && options.method === 'POST') return Promise.reject(new Error('La transferencia supera las existencias disponibles del almacén de origen'));
      if (path.startsWith('/api/inventory/movements')) return Promise.resolve({ data: [movement], pagination: { page: 1, limit: 25, total: 1, pages: 1 } });
      if (path.startsWith('/api/inventory?')) return Promise.resolve({ data: [stock], pagination: { page: 1, limit: 25, total: 1, pages: 1 } });
      if (path === '/api/inventory/warehouses') return Promise.resolve({ data: [warehouse, destination] });
      if (path.startsWith('/api/products?')) return Promise.resolve({ data: [product] });
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    render(<InventoryPage session={session} />);
    await screen.findAllByText('Producto uno');
    fireEvent.click(screen.getByRole('button', { name: 'Transferir' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: /Producto uno/ });
    fireEvent.change(within(dialog).getByLabelText('Producto'), { target: { value: product.id } });
    fireEvent.change(within(dialog).getByLabelText('Almacén de origen'), { target: { value: warehouse.id } });
    fireEvent.change(within(dialog).getByLabelText('Almacén destino'), { target: { value: destination.id } });
    fireEvent.change(within(dialog).getByLabelText('Cantidad'), { target: { value: '2' } });
    fireEvent.change(within(dialog).getByLabelText('Motivo'), { target: { value: 'Reubicación' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar operación' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('La transferencia supera las existencias disponibles');
    expect(apiRequest).toHaveBeenCalledWith('/api/inventory/transfer', expect.objectContaining({ method: 'POST', body: JSON.stringify({ productId: product.id, fromWarehouseId: warehouse.id, toWarehouseId: destination.id, quantity: 2, reason: 'Reubicación' }) }));
  });
});
