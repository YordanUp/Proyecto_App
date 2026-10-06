import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReturnsPanel from './ReturnsPanel';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ apiRequest: vi.fn() }));

const session = { token: 'token', user: { id: 'user-1', permissions: ['sales.returns.read', 'sales.returns.create'] } };
const sale = {
  id: 'sale-1', folio: 'VEN-2026-000001', status: 'confirmed', total: 116, customerId: 'client-1',
  customer: { id: 'client-1', name: 'Cliente Uno' },
  items: [{ productId: 'product-1', warehouseId: 'warehouse-1', productNameSnapshot: 'Producto Uno', quantity: 10, unitPrice: 10, taxRate: 16, total: 116, warehouse: { name: 'Central' } }]
};
const returnItem = { id: 'return-1', folio: 'DEV-2026-000001', saleId: sale.id, sale: { folio: sale.folio }, customer: sale.customer, reason: 'Producto sin usar', status: 'processed', total: 34.8, subtotal: 30, taxes: 4.8, processedAt: '2026-01-01T12:00:00.000Z', createdBy: { name: 'Admin' }, items: [{ saleLineIndex: 0, productId: 'product-1', warehouseId: 'warehouse-1', productNameSnapshot: 'Producto Uno', quantity: 3, unitPrice: 10, taxRate: 16, subtotal: 30, tax: 4.8, total: 34.8, warehouse: { name: 'Central' } }] };

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation((path, options = {}) => {
    if (path.startsWith('/api/sales/returns?')) return Promise.resolve({ data: [returnItem], pagination: { page: 1, pages: 1, total: 1 } });
    if (path === `/api/sales/returns/${returnItem.id}`) return Promise.resolve({ data: returnItem });
    if (path === `/api/sales/${sale.id}`) return Promise.resolve({ data: sale });
    if (path === `/api/sales/returns?saleId=${sale.id}&page=1&limit=100`) return Promise.resolve({ data: [returnItem] });
    if (path === '/api/sales?status=confirmed&page=1&limit=100&sort=createdAt&order=desc') return Promise.resolve({ data: [sale] });
    if (path === '/api/sales/returns' && options.method === 'POST') return Promise.resolve({ data: { ...returnItem, folio: 'DEV-2026-000002' }, message: 'Devolución procesada' });
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
});

describe('ReturnsPanel', () => {
  it('RET-WEB-001/002/007 lista y controla el acceso por permisos', async () => {
    const { unmount } = render(<ReturnsPanel session={session} />);
    expect(await screen.findByText('DEV-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('VEN-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('Producto sin usar')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/sales\/returns\?/));
    unmount();
    render(<ReturnsPanel session={{ user: { permissions: [] } }} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso');
    expect(screen.queryByRole('button', { name: '+ Crear devolución' })).not.toBeInTheDocument();
  });

  it('RET-WEB-003/004/005 calcula disponibilidad y envía cantidades parciales desde la venta', async () => {
    render(<ReturnsPanel session={session} />);
    fireEvent.click(await screen.findByRole('button', { name: '+ Crear devolución' }));
    await screen.findByRole('option', { name: /VEN-2026-000001/ });
    fireEvent.change(screen.getByLabelText('Venta confirmada'), { target: { value: sale.id } });
    expect(await screen.findByText(/vendida 10 · devuelta 3 · disponible 7/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Devolver partida 1'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Empaque intacto' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form'));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/sales/returns', expect.objectContaining({ method: 'POST' })));
    const [, options] = apiRequest.mock.calls.find(([path, value]) => path === '/api/sales/returns' && value?.method === 'POST');
    expect(JSON.parse(options.body)).toEqual({ saleId: sale.id, reason: 'Empaque intacto', notes: '', items: [{ productId: 'product-1', warehouseId: 'warehouse-1', saleLineIndex: 0, quantity: 2 }] });
  });

  it('RET-WEB-006 mantiene el formulario abierto y muestra errores de exceso', async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path.startsWith('/api/sales/returns?')) return Promise.resolve({ data: [] });
      if (path === '/api/sales?status=confirmed&page=1&limit=100&sort=createdAt&order=desc') return Promise.resolve({ data: [sale] });
      if (path === `/api/sales/${sale.id}`) return Promise.resolve({ data: sale });
      if (path === `/api/sales/returns?saleId=${sale.id}&page=1&limit=100`) return Promise.resolve({ data: [] });
      if (path === '/api/sales/returns' && options.method === 'POST') return Promise.reject(new Error('La cantidad excede lo disponible'));
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    render(<ReturnsPanel session={session} />);
    fireEvent.click(await screen.findByRole('button', { name: '+ Crear devolución' }));
    await screen.findByRole('option', { name: /VEN-2026-000001/ });
    fireEvent.change(screen.getByLabelText('Venta confirmada'), { target: { value: sale.id } });
    await screen.findByText(/disponible 10/);
    fireEvent.change(screen.getByLabelText('Devolver partida 1'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Exceso' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('La cantidad excede');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('RET-WEB-008 muestra el detalle persistido', async () => {
    render(<ReturnsPanel session={session} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Detalle' }));
    expect(await screen.findByRole('heading', { name: 'DEV-2026-000001' })).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/api/sales/returns/return-1');
  });
});
