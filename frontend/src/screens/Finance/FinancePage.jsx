import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';

const PAGE_SIZE = 20;
const LABELS = { pending: 'Pendiente', partial: 'Parcial', paid: 'Pagada', cancelled: 'Cancelada' };
const money = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);
const can = (user, permission) => Array.isArray(user?.permissions) && user.permissions.includes(permission);

function PaymentDialog({ account, kind, saving, onClose, onSubmit }) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setError('');
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('El pago debe ser mayor a cero.');
    if (Math.round(value * 100) / 100 > account.balance) return setError(`El pago supera el saldo pendiente de ${money(account.balance)}.`);
    try { await onSubmit({ amount: value, paymentMethod, ...(description.trim() ? { description: description.trim() } : {}) }); }
    catch (submitError) { setError(submitError.message || 'No se pudo registrar el pago.'); }
  }
  const label = kind === 'receivable' ? 'Registrar cobro' : 'Registrar pago';
  return <div className="finance-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="card finance-modal" role="dialog" aria-modal="true" aria-labelledby="finance-payment-title">
      <div className="sales-modal-heading"><div><span className="eyebrow">{account.folio}</span><h3 id="finance-payment-title">{label}</h3></div><button type="button" className="users-icon-button" aria-label="Cerrar" onClick={onClose}>×</button></div>
      <p className="finance-balance-note">Saldo pendiente: <strong>{money(account.balance)}</strong></p>
      <form onSubmit={submit}>
        <label>Monto<input type="number" min="0.01" max={account.balance} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></label>
        <label>Método<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}><option value="transfer">Transferencia</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="check">Cheque</option><option value="other">Otro</option></select></label>
        <label>Descripción (opcional)<input maxLength="300" value={description} onChange={event => setDescription(event.target.value)} placeholder="Referencia del cobro o pago" /></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="sales-modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cerrar</button><button type="submit" className="users-primary-button" disabled={saving}>{saving ? 'Guardando…' : label}</button></div>
      </form>
    </section>
  </div>;
}

export default function FinancePage({ session }) {
  const [tab, setTab] = useState('receivables');
  const [receivables, setReceivables] = useState([]); const [payables, setPayables] = useState([]); const [movements, setMovements] = useState([]);
  const [pages, setPages] = useState({ receivables: { page: 1, pages: 0, total: 0 }, payables: { page: 1, pages: 0, total: 0 }, movements: { page: 1, pages: 0, total: 0 } });
  const [page, setPage] = useState({ receivables: 1, payables: 1, movements: 1 });
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [activeAccount, setActiveAccount] = useState(null); const [saving, setSaving] = useState(false);
  const user = session?.user; const canRead = can(user, 'finance.read');
  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), sort: 'createdAt', order: 'desc' });
    if (search.trim()) params.set('search', search.trim()); if (['pending', 'partial', 'paid', 'cancelled'].includes(status)) params.set('status', status);
    if (from) params.set('from', from); if (to) params.set('to', to);
    return params;
  }, [search, status, from, to]);

  async function loadAll() {
    if (!canRead) { setReceivables([]); setPayables([]); setMovements([]); setLoading(false); setError('No tienes permiso para consultar Finanzas.'); return; }
    setLoading(true); setError('');
    const requests = await Promise.allSettled([
      apiRequest(`/api/finance/receivables?${new URLSearchParams({ ...Object.fromEntries(query), page: String(page.receivables) })}`),
      apiRequest(`/api/finance/payables?${new URLSearchParams({ ...Object.fromEntries(query), page: String(page.payables) })}`),
      apiRequest(`/api/finance/movements?${new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page.movements), order: 'desc', ...(search.trim() ? { search: search.trim() } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(status === 'RECEIVABLE_PAYMENT' || status === 'PAYABLE_PAYMENT' ? { type: status } : {}) })}`)
    ]);
    const labels = ['cuentas por cobrar', 'cuentas por pagar', 'movimientos'];
    const failures = requests.flatMap((result, index) => result.status === 'rejected' ? [`No se pudieron cargar ${labels[index]}. ${result.reason.message}`] : []);
    if (requests[0].status === 'fulfilled') { setReceivables(Array.isArray(requests[0].value.data) ? requests[0].value.data : []); setPages(current => ({ ...current, receivables: requests[0].value.pagination || current.receivables })); }
    if (requests[1].status === 'fulfilled') { setPayables(Array.isArray(requests[1].value.data) ? requests[1].value.data : []); setPages(current => ({ ...current, payables: requests[1].value.pagination || current.payables })); }
    if (requests[2].status === 'fulfilled') { setMovements(Array.isArray(requests[2].value.data) ? requests[2].value.data : []); setPages(current => ({ ...current, movements: requests[2].value.pagination || current.movements })); }
    setError(failures.join(' ')); setLoading(false);
  }

  useEffect(() => { loadAll(); }, [canRead, query.toString(), status, page.receivables, page.payables, page.movements, session?.token]);

  function filtersChanged(setter, value) { setter(value); setPage({ receivables: 1, payables: 1, movements: 1 }); }
  async function submitPayment(input) {
    const { kind, account } = activeAccount;
    const endpoint = kind === 'receivable' ? `/api/finance/receivables/${account.id}/payments` : `/api/finance/payables/${account.id}/payments`;
    const confirmation = kind === 'receivable' ? '¿Registrar este cobro?' : '¿Registrar este pago al proveedor?';
    if (!window.confirm(`${confirmation} Saldo actual: ${money(account.balance)}. Monto: ${money(input.amount)}.`)) return;
    setSaving(true); setError('');
    try {
      const result = await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(input) });
      setNotice(`${result.data.account.folio}: pago registrado. Saldo restante ${money(result.data.account.balance)}.`);
      setActiveAccount(null); await loadAll();
    } catch (paymentError) { throw paymentError; }
    finally { setSaving(false); }
  }

  function paginationControls(name, noun) {
    const value = pages[name];
    if (!value || value.pages <= 1) return null;
    return <nav className="inventory-pagination" aria-label={`Paginación ${noun}`}><span>{value.total} · Página {value.page} de {value.pages}</span><div><button type="button" className="secondary" disabled={page[name] <= 1} onClick={() => setPage(current => ({ ...current, [name]: current[name] - 1 }))}>Anterior</button><button type="button" className="secondary" disabled={page[name] >= value.pages} onClick={() => setPage(current => ({ ...current, [name]: current[name] + 1 }))}>Siguiente</button></div></nav>;
  }

  return <div className="app-shell dashboard-layout finance-page">
    {notice ? <p className="inventory-notice" role="status">{notice}</p> : null}{error ? <p className="card warning-box" role="alert">{error}</p> : null}
    {!canRead ? <section className="card finance-empty" aria-label="Sin acceso">No tienes permiso para consultar Finanzas.</section> : <>
      <section className="card finance-intro"><div><h3>Finanzas persistentes</h3><p>Cuentas por cobrar y pagar nacen de ventas confirmadas y compras recibidas. Los pagos se registran en el historial inmutable.</p></div></section>
      <section className="card finance-filters" aria-label="Filtros de finanzas">
        <label>Buscar folio, cliente o proveedor<input type="search" value={search} onChange={event => filtersChanged(setSearch, event.target.value)} placeholder="CXC, CXP o nombre" /></label>
        <label>{tab === 'movements' ? 'Tipo de movimiento' : 'Estado'}<select value={status} onChange={event => filtersChanged(setStatus, event.target.value)}><option value="">Todos</option>{tab === 'movements' ? <><option value="RECEIVABLE_PAYMENT">Cobros CxC</option><option value="PAYABLE_PAYMENT">Pagos CxP</option></> : <><option value="pending">Pendiente</option><option value="partial">Parcial</option><option value="paid">Pagada</option><option value="cancelled">Cancelada</option></>}</select></label>
        <label>Desde<input type="date" value={from} onChange={event => filtersChanged(setFrom, event.target.value)} /></label>
        <label>Hasta<input type="date" value={to} onChange={event => filtersChanged(setTo, event.target.value)} /></label>
      </section>
      <nav className="finance-tabs" aria-label="Secciones de Finanzas"><button type="button" className={tab === 'receivables' ? 'active' : ''} onClick={() => { setTab('receivables'); setStatus(''); }}>Cuentas por cobrar</button><button type="button" className={tab === 'payables' ? 'active' : ''} onClick={() => { setTab('payables'); setStatus(''); }}>Cuentas por pagar</button><button type="button" className={tab === 'movements' ? 'active' : ''} onClick={() => { setTab('movements'); setStatus(''); }}>Movimientos</button></nav>
      {loading ? <div className="card" role="status">Cargando finanzas…</div> : tab === 'receivables' ? <section className="card finance-table-card"><h3>Cuentas por cobrar</h3><div className="finance-table-wrap"><table className="data-table"><thead><tr><th>Cuenta</th><th>Cliente</th><th>Venta</th><th>Original</th><th>Pagado</th><th>Saldo</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{!receivables.length ? <tr><td colSpan="8" className="empty-state">No hay cuentas por cobrar.</td></tr> : receivables.map(account => <tr key={account.id}><td><strong>{account.folio}</strong></td><td>{account.customer?.name || account.customerId}</td><td>{account.sale?.folio || '—'}</td><td>{money(account.originalAmount)}</td><td>{money(account.paidAmount)}</td><td>{money(account.balance)}</td><td><span className={`finance-status ${account.status}`}>{LABELS[account.status] || account.status}</span></td><td>{account.balance > 0 && account.status !== 'cancelled' && can(user, 'finance.receive_payment') ? <button type="button" className="users-primary-button" onClick={() => setActiveAccount({ kind: 'receivable', account })}>Registrar cobro</button> : '—'}</td></tr>)}</tbody></table></div>{paginationControls('receivables', 'cuentas por cobrar')}</section> : tab === 'payables' ? <section className="card finance-table-card"><h3>Cuentas por pagar</h3><div className="finance-table-wrap"><table className="data-table"><thead><tr><th>Cuenta</th><th>Proveedor</th><th>Compra</th><th>Original</th><th>Pagado</th><th>Saldo</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{!payables.length ? <tr><td colSpan="8" className="empty-state">No hay cuentas por pagar.</td></tr> : payables.map(account => <tr key={account.id}><td><strong>{account.folio}</strong></td><td>{account.supplier?.name || account.supplierId}</td><td>{account.purchase?.folio || '—'}</td><td>{money(account.originalAmount)}</td><td>{money(account.paidAmount)}</td><td>{money(account.balance)}</td><td><span className={`finance-status ${account.status}`}>{LABELS[account.status] || account.status}</span></td><td>{account.balance > 0 && account.status !== 'cancelled' && can(user, 'finance.make_payment') ? <button type="button" className="users-primary-button" onClick={() => setActiveAccount({ kind: 'payable', account })}>Registrar pago</button> : '—'}</td></tr>)}</tbody></table></div>{paginationControls('payables', 'cuentas por pagar')}</section> : <section className="card finance-table-card"><h3>Movimientos financieros</h3><div className="finance-table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Dirección</th><th>Monto</th><th>Cuenta</th><th>Referencia</th><th>Usuario</th></tr></thead><tbody>{!movements.length ? <tr><td colSpan="7" className="empty-state">No hay movimientos financieros.</td></tr> : movements.map(movement => <tr key={movement.id}><td>{new Date(movement.createdAt).toLocaleString()}</td><td>{movement.type === 'RECEIVABLE_PAYMENT' ? 'Cobro CxC' : 'Pago CxP'}</td><td><span className={`finance-direction ${movement.direction}`}>{movement.direction === 'IN' ? 'Entrada' : 'Salida'}</span></td><td>{money(movement.amount)}</td><td>{movement.accountFolio || '—'}</td><td>{movement.referenceFolio || '—'} · {movement.description}</td><td>{movement.createdBy?.name || '—'}</td></tr>)}</tbody></table></div>{paginationControls('movements', 'movimientos')}</section>}
    </>}
    {activeAccount ? <PaymentDialog account={activeAccount.account} kind={activeAccount.kind} saving={saving} onClose={() => setActiveAccount(null)} onSubmit={submitPayment} /> : null}
  </div>;
}
