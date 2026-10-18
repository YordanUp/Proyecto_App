import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import FinancePage from './FinancePage';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ API_URL: 'http://localhost:4000', apiRequest: vi.fn() }));

const receivable = { id: 'ar-1', folio: 'CXC-2026-000001', customer: { id: 'customer-1', name: 'Cliente Uno' }, sale: { id: 'sale-1', folio: 'VEN-2026-000001' }, originalAmount: 1000, paidAmount: 0, balance: 1000, status: 'pending' };
const payable = { id: 'ap-1', folio: 'CXP-2026-000001', supplier: { id: 'supplier-1', name: 'Proveedor Uno' }, purchase: { id: 'purchase-1', folio: 'COM-2026-000001', status: 'ordered' }, originalAmount: 500, paidAmount: 200, balance: 300, status: 'partial' };
const movement = { id: 'movement-1', type: 'RECEIVABLE_PAYMENT', direction: 'IN', amount: 400, accountFolio: receivable.folio, referenceFolio: 'VEN-2026-000001', description: 'Cobro', createdBy: { name: 'Operador' }, createdAt: '2026-01-01T12:00:00.000Z' };
const session = { token: 'token', user: { id: 'user-1', permissions: ['finance.read', 'finance.receive_payment', 'finance.make_payment'] } };

beforeEach(() => apiRequest.mockReset());

function setupApi({ paymentError = null, receivableAccount = receivable, payableAccount = payable } = {}) {
  apiRequest.mockImplementation((path, options = {}) => {
    if (typeof path !== 'string') return Promise.resolve({ data: [] });
    if (path.startsWith('/api/finance/receivables?')) return Promise.resolve({ data: [receivableAccount], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
    if (path.startsWith('/api/finance/payables?')) return Promise.resolve({ data: [payableAccount], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
    if (path.startsWith('/api/finance/movements?')) return Promise.resolve({ data: [movement], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
    if (path.endsWith('/reject') && options.method === 'POST') return Promise.resolve({ message: 'Compra rechazada correctamente.' });
    if (path.endsWith('/payments') && options.method === 'POST') {
      const isPayable = path.includes('/payables/');
      const account = isPayable ? payableAccount : receivableAccount;
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
    const account = { ...receivable, originalAmount: 10000, paidAmount: 4000, balance: 6000 };
    setupApi({ receivableAccount: account });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<FinancePage session={session} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Monto')).toHaveValue('6000');
    expect(within(dialog).getByLabelText('Monto')).toHaveAttribute('type', 'text');
    expect(within(dialog).getByLabelText('Monto')).toHaveAttribute('inputMode', 'decimal');
    expect(within(dialog).getByText('Cuenta').nextElementSibling).toHaveTextContent('CXC-2026-000001');
    expect(within(dialog).getByText('Cliente').nextElementSibling).toHaveTextContent('Cliente Uno');
    expect(within(dialog).getByText('Importe original').nextElementSibling).toHaveTextContent('$10,000.00');
    expect(within(dialog).getByText('Pagado anteriormente').nextElementSibling).toHaveTextContent('$4,000.00');
    expect(within(dialog).getByText('Saldo pendiente').nextElementSibling).toHaveTextContent('$6,000.00');
    fireEvent.change(within(dialog).getByLabelText('Monto'), { target: { value: '2000' } });
    expect(within(dialog).getByRole('status')).toHaveTextContent('Saldo después del cobro: $4,000.00');
    fireEvent.change(within(dialog).getByLabelText('Método'), { target: { value: 'transfer' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar cobro' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(`/api/finance/receivables/${receivable.id}/payments`, expect.objectContaining({ method: 'POST' })));
    const post = apiRequest.mock.calls.find(([path, options]) => path.endsWith('/payments') && options?.method === 'POST');
    expect(JSON.parse(post[1].body)).toEqual({ amount: 2000, paymentMethod: 'transfer' });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('$2,000.00'));
    expect(await screen.findByRole('status')).toHaveTextContent('Saldo restante $4,000.00');
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
    expect(within(dialog).getByText('Proveedor').nextElementSibling).toHaveTextContent('Proveedor Uno');
    fireEvent.change(within(dialog).getByLabelText('Monto'), { target: { value: '300' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar pago' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(`/api/finance/payables/${payable.id}/payments`, expect.objectContaining({ method: 'POST' })));
    expect(await screen.findByRole('status')).toHaveTextContent('Saldo restante $0.00');
  });

  it('genera y descarga factura con permiso finance.make_payment', async () => {
    setupApi({ payableAccount: { ...payable, balance: 0, status: 'paid' } });
    localStorage.setItem('erp_token', 'token');
    const originalFetch = globalThis.fetch; const originalCreateObjectURL = URL.createObjectURL; const originalRevokeObjectURL = URL.revokeObjectURL;
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, headers: { get: () => 'attachment; filename="Factura_FAC-2026-000001.docx"' }, blob: async () => new Blob(['docx']) });
    URL.createObjectURL = vi.fn(() => 'blob:invoice'); URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<FinancePage session={session} />); fireEvent.click(await screen.findByRole('button', { name: 'Cuentas por pagar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Generar factura' }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/finance\/payables\/ap-1\/invoice$/), expect.objectContaining({ headers: { Authorization: 'Bearer token' } })));
    expect(click).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Factura generada descargada.');
    globalThis.fetch = originalFetch; URL.createObjectURL = originalCreateObjectURL; URL.revokeObjectURL = originalRevokeObjectURL; click.mockRestore();
  });

  it('muestra Facturado y permite descargarlo conservando Registrar pago', async () => {
    setupApi({ payableAccount: { ...payable, invoiceStatus: 'invoiced', invoiceNumber: 'FAC-2026-000001' } });
    render(<FinancePage session={session} />); fireEvent.click(await screen.findByRole('button', { name: 'Cuentas por pagar' }));
    expect(await screen.findByText('Facturado · FAC-2026-000001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar factura' })).toBeInTheDocument();
  });

  it('rechaza una compra impaga con confirmación y refresca la lista', async () => {
    const account = { ...payable, paidAmount: 0, balance: 500, status: 'pending' };
    setupApi({ payableAccount: account });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<FinancePage session={session} />); fireEvent.click(await screen.findByRole('button', { name: 'Cuentas por pagar' }));
    const button = await screen.findByRole('button', { name: 'Rechazar compra' });
    fireEvent.click(button);
    expect(confirm).toHaveBeenCalledWith('¿Rechazar esta compra? La compra será cancelada y no podrá recibirse.');
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(`/api/finance/payables/${account.id}/reject`, { method: 'POST' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Compra rechazada correctamente.');
    expect(apiRequest.mock.calls.filter(([path]) => path.startsWith('/api/finance/payables?')).length).toBeGreaterThan(1);
    vi.restoreAllMocks();
  });

  it('oculta rechazar compra si tiene pagos, ya fue cancelada, recibida o falta permiso', async () => {
    for (const account of [
      { ...payable, paidAmount: 1 },
      { ...payable, status: 'cancelled', paidAmount: 0 },
      { ...payable, paidAmount: 0, purchase: { ...payable.purchase, status: 'received' } }
    ]) {
      setupApi({ payableAccount: account }); render(<FinancePage session={session} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Cuentas por pagar' }));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Rechazar compra' })).not.toBeInTheDocument());
      cleanup();
    }
    setupApi({ payableAccount: { ...payable, paidAmount: 0 } });
    render(<FinancePage session={{ ...session, user: { ...session.user, permissions: ['finance.read'] } }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cuentas por pagar' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Rechazar compra' })).not.toBeInTheDocument());
  });

  it('rechaza en la interfaz un sobrepago y comunica un error del servidor', async () => {
    const account = { ...receivable, originalAmount: 10000, paidAmount: 4000, balance: 6000 };
    setupApi({ paymentError: 'El saldo cambió por otro pago; vuelve a consultar la cuenta', receivableAccount: account });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<FinancePage session={session} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Monto'), { target: { value: '7000' } });
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Registrar cobro' }).closest('form'));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('El monto no puede superar el saldo pendiente de $6,000.00.');
    expect(apiRequest).not.toHaveBeenCalledWith(`/api/finance/receivables/${receivable.id}/payments`, expect.anything());
    fireEvent.change(within(dialog).getByLabelText('Monto'), { target: { value: '500' } });
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Registrar cobro' }).closest('form'));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('El saldo cambió por otro pago');
    vi.restoreAllMocks();
  });

  it('FIN-UX accepts total payment and previews zero; wheel leaves amount unchanged', async () => {
    const account = { ...receivable, originalAmount: 10000, paidAmount: 4000, balance: 6000 };
    setupApi({ receivableAccount: account });
    render(<FinancePage session={session} />); fireEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }));
    const dialog = await screen.findByRole('dialog'); const input = within(dialog).getByLabelText('Monto');
    expect(within(dialog).getByRole('status')).toHaveTextContent('Saldo después del cobro: $0.00');
    fireEvent.wheel(input, { deltaY: -100 }); expect(input).toHaveValue('6000');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar cobro' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(`/api/finance/receivables/${account.id}/payments`, expect.objectContaining({ method: 'POST' })));
    vi.restoreAllMocks();
  });

  it('FIN-UX shows a specific error for an empty amount without calling the API', async () => {
    setupApi(); render(<FinancePage session={session} />); fireEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }));
    const dialog = await screen.findByRole('dialog'); fireEvent.change(within(dialog).getByLabelText('Monto'), { target: { value: '' } });
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Registrar cobro' }).closest('form'));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Ingresa un monto.');
    expect(apiRequest).not.toHaveBeenCalledWith(`/api/finance/receivables/${receivable.id}/payments`, expect.anything());
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
