import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import FinancePage from './FinancePage';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ apiRequest: vi.fn() }));

const receivable = { id: 'ar-1', folio: 'CXC-2026-000001', customer: { id: 'customer-1', name: 'Cliente Uno' }, sale: { id: 'sale-1', folio: 'VEN-2026-000001' }, originalAmount: 1000, paidAmount: 0, balance: 1000, status: 'pending' };
const payable = { id: 'ap-1', folio: 'CXP-2026-000001', supplier: { id: 'supplier-1', name: 'Proveedor Uno' }, purchase: { id: 'purchase-1', folio: 'COM-2026-000001' }, originalAmount: 500, paidAmount: 200, balance: 300, status: 'partial' };
const movement = { id: 'movement-1', type: 'RECEIVABLE_PAYMENT', direction: 'IN', amount: 400, accountFolio: receivable.folio, referenceFolio: 'VEN-2026-000001', description: 'Cobro', createdBy: { name: 'Operador' }, createdAt: '2026-01-01T12:00:00.000Z' };
const session = { token: 'token', user: { id: 'user-1', permissions: ['finance.read', 'finance.receive_payment', 'finance.make_payment'] } };

beforeEach(() => apiRequest.mockReset());

function setupApi({ paymentError = null } = {}) {
  apiRequest.mockImplementation((path, options = {}) => {
    if (typeof path !== 'string') return Promise.resolve({ data: [] });
    if (path.startsWith('/api/finance/receivables?')) return Promise.resolve({ data: [receivable], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
    if (path.startsWith('/api/finance/payables?')) return Promise.resolve({ data: [payable], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
    if (path.startsWith('/api/finance/movements?')) return Promise.resolve({ data: [movement], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
    if (path.endsWith('/payments') && options.method === 'POST') {
      const isPayable = path.includes('/payables/');
      const account = isPayable ? payable : receivable;
      const amount = Number(JSON.parse(options.body).amount);
      return paymentError ? Promise.reject(new Error(paymentError)) : Promise.resolve({ message: 'Pago registrado', data: { account: { ...account, paidAmount: account.paidAmount + amount, balance: account.balance - amount, status: account.balance - amount === 0 ? 'paid' : 'partial' }, movement } });
    }
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
}

describe('FinancePage', () => {
  it('lista cuentas por cobrar y ofrece cobros con permiso', async () => {
    setupApi();
    render(<FinancePage session={session} />);
    expect(await screen.findByText('CXC-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('Cliente Uno')).toBeInTheDocument();
    expect(screen.getByText('VEN-2026-000001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/finance\/receivables\?/));
  });

  it('registra un pago parcial de CxC después de confirmar y muestra saldo restante', async () => {
    setupApi();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<FinancePage session={session} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Monto'), { target: { value: '400' } });
    fireEvent.change(within(dialog).getByLabelText('Método'), { target: { value: 'transfer' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar cobro' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(`/api/finance/receivables/${receivable.id}/payments`, expect.objectContaining({ method: 'POST' })));
    const post = apiRequest.mock.calls.find(([path, options]) => path.endsWith('/payments') && options?.method === 'POST');
    expect(JSON.parse(post[1].body)).toEqual({ amount: 400, paymentMethod: 'transfer' });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('$400.00'));
    expect(await screen.findByRole('status')).toHaveTextContent('Saldo restante $600.00');
    vi.restoreAllMocks();
  });

  it('lista CxP y registra el pago restante de una cuenta parcial', async () => {
    setupApi();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<FinancePage session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cuentas por pagar' }));
    expect(await screen.findByText('CXP-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('Proveedor Uno')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Monto'), { target: { value: '300' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar pago' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(`/api/finance/payables/${payable.id}/payments`, expect.objectContaining({ method: 'POST' })));
    expect(await screen.findByRole('status')).toHaveTextContent('Saldo restante $0.00');
  });

  it('rechaza en la interfaz un sobrepago y comunica un error del servidor', async () => {
    setupApi({ paymentError: 'El saldo cambió por otro pago; vuelve a consultar la cuenta' });
    render(<FinancePage session={session} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Monto'), { target: { value: '1001' } });
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Registrar cobro' }).closest('form'));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('supera el saldo pendiente');
    expect(apiRequest).not.toHaveBeenCalledWith(`/api/finance/receivables/${receivable.id}/payments`, expect.anything());
    fireEvent.change(within(dialog).getByLabelText('Monto'), { target: { value: '500' } });
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Registrar cobro' }).closest('form'));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('El saldo cambió por otro pago');
  });

  it('filtra movimientos por texto y tipo y presenta dirección y referencia', async () => {
    setupApi();
    render(<FinancePage session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Movimientos' }));
    expect(await screen.findByText('Cobro CxC')).toBeInTheDocument();
    expect(screen.getByText('Entrada')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar folio, cliente o proveedor'), { target: { value: 'CXC-2026' } });
    fireEvent.change(screen.getByLabelText('Tipo de movimiento'), { target: { value: 'RECEIVABLE_PAYMENT' } });
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/finance\/movements\?.*search=CXC-2026.*type=RECEIVABLE_PAYMENT/)));
  });

  it('oculta cuentas y pagos a quien carece de finance.read', async () => {
    render(<FinancePage session={{ ...session, user: { ...session.user, permissions: [] } }} />);
    expect(await screen.findByLabelText('Sin acceso')).toHaveTextContent('No tienes permiso para consultar Finanzas');
    expect(screen.queryByRole('button', { name: 'Registrar cobro' })).not.toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
