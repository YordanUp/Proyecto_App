import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SalesPage from './SalesPage';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ apiRequest: vi.fn() }));
const client = { id: 'client-1', name: 'Cliente Cotización' };
const product = { id: 'product-1', code: 'P-1', name: 'Producto Cotizable', purchasePrice: 5, salePrice: 10 };
const warehouse = { id: 'warehouse-1', name: 'Central' };
const quote = { id: 'quote-1', folio: 'COT-2026-000001', customerId: client.id, customer: client, items: [{ productId: product.id, warehouseId: warehouse.id, productNameSnapshot: product.name, skuSnapshot: product.code, quantity: 1, unitPrice: 10, taxRate: 0, subtotal: 10, tax: 0, total: 10 }], subtotal: 10, taxes: 0, total: 10, status: 'draft', createdAt: '2026-01-01T00:00:00Z' };
const session = { token: 'token', user: { id: 'user-1', permissions: ['sales.read', 'sales.create', 'sales.update', 'sales.cancel'] } };
beforeEach(() => { apiRequest.mockReset(); });
function mockApi({ failure = false, status = 'draft' } = {}) {
  apiRequest.mockImplementation((path, options = {}) => {
    if (path.startsWith('/api/sales?')) return Promise.resolve({ data: [], pagination: { page: 1, pages: 0, total: 0 } });
    if (path.startsWith('/api/sales/quotations?')) return Promise.resolve({ data: [{ ...quote, status }], pagination: { page: 1, pages: 1, total: 1 } });
    if (path === '/api/clients?status=active&page=1&limit=100') return Promise.resolve({ data: [client] });
    if (path === '/api/products?status=active&page=1&limit=100') return Promise.resolve({ data: [product] });
    if (path === '/api/inventory/warehouses') return Promise.resolve({ data: [warehouse] });
    if (path === '/api/sales/quotations' && options.method === 'POST') return failure ? Promise.reject(new Error('Cliente no disponible')) : Promise.resolve({ data: { ...quote, id: 'quote-2', folio: 'COT-2026-000002' } });
    if (path === '/api/sales/quotations/quote-1' && options.method === 'PUT') return Promise.resolve({ data: { ...quote, total: 20 } });
    if (path === '/api/sales/quotations/quote-1' && !options.method) return Promise.resolve({ data: { ...quote, status } });
    if (path.endsWith('/convert')) return Promise.resolve({ data: { quotation: { ...quote, status: 'converted' }, sale: { id: 'sale-2', folio: 'VEN-2026-000002', status: 'draft' } } });
    if (path.endsWith('/send')) return Promise.resolve({ message: 'Cotización enviada', data: { ...quote, status: 'sent' } });
    return Promise.resolve({ data: [] });
  });
}
async function openQuotations() { render(<SalesPage session={session} />); fireEvent.click(screen.getByRole('button', { name: 'Cotizaciones' })); }

describe('QuotationsPanel', () => {
  it('QUO-WEB-001/004 muestra cotización persistente con estado y filtros', async () => {
    mockApi(); await openQuotations(); expect(await screen.findByText('COT-2026-000001')).toBeInTheDocument(); expect(screen.getByText('Cliente Cotización')).toBeInTheDocument(); expect(screen.getAllByText('Borrador').length).toBeGreaterThan(0); expect(apiRequest).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/sales\/quotations\?/));
  });
  it('QUO-WEB-002 crea mediante API y carga catálogos persistentes', async () => {
    mockApi(); await openQuotations(); fireEvent.click(await screen.findByRole('button', { name: '+ Nueva cotización' })); const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Cliente'), { target: { value: client.id } }); fireEvent.change(within(dialog).getByLabelText('Producto'), { target: { value: product.id } }); fireEvent.change(within(dialog).getByLabelText('Almacén'), { target: { value: warehouse.id } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar borrador' })); await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/sales/quotations', expect.objectContaining({ method: 'POST' })));
  });
  it('QUO-WEB-003 edita un borrador y recalcula mediante PUT', async () => {
    mockApi(); await openQuotations(); fireEvent.click(await screen.findByRole('button', { name: 'Editar' })); const dialog = await screen.findByRole('dialog'); fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar borrador' })); await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/sales/quotations/quote-1', expect.objectContaining({ method: 'PUT' })));
  });
  it('QUO-WEB-004 cambia estados y QUO-WEB-005 convierte con confirmación', async () => {
    mockApi({ status: 'accepted' }); vi.spyOn(window, 'confirm').mockReturnValue(true); await openQuotations(); fireEvent.click(await screen.findByRole('button', { name: 'Convertir a venta' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('venta en estado borrador'));
    expect(await screen.findByText('Venta creada: VEN-2026-000002 · Borrador')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/api/sales/quotations/quote-1/convert', expect.objectContaining({ method: 'POST' })); vi.restoreAllMocks();
  });
  it('QUO-WEB-006 oculta acciones por RBAC y QUO-WEB-007 comunica errores del API', async () => {
    mockApi({ failure: true }); render(<SalesPage session={session} />); fireEvent.click(screen.getByRole('button', { name: 'Cotizaciones' })); expect(await screen.findByText('COT-2026-000001')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: '+ Nueva cotización' })); const dialog = await screen.findByRole('dialog'); await within(dialog).findByRole('option', { name: /Producto Cotizable/ }); fireEvent.change(within(dialog).getByLabelText('Cliente'), { target: { value: client.id } }); fireEvent.change(within(dialog).getByLabelText('Producto'), { target: { value: product.id } }); fireEvent.change(within(dialog).getByLabelText('Almacén'), { target: { value: warehouse.id } }); fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar borrador' })); expect(await within(dialog).findByRole('alert')).toHaveTextContent('Cliente no disponible');
    const restricted = { ...session, user: { ...session.user, permissions: ['sales.read'] } }; const { container } = render(<SalesPage session={restricted} />); fireEvent.click(within(container).getByRole('button', { name: 'Cotizaciones' })); expect(await within(container).findByText('COT-2026-000001')).toBeInTheDocument(); expect(within(container).queryByRole('button', { name: '+ Nueva cotización' })).not.toBeInTheDocument();
  });
});
