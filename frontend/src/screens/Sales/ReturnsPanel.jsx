import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';

const PAGE_SIZE = 20;
const money = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);
const permission = (user, value) => Array.isArray(user?.permissions) && user.permissions.includes(value);

export default function ReturnsPanel({ session, createFromSaleId = '' }) {
  const user = session?.user;
  const canRead = permission(user, 'sales.returns.read');
  const canCreate = permission(user, 'sales.returns.create');
  const [items, setItems] = useState([]); const [page, setPage] = useState(1); const [pagination, setPagination] = useState({ pages: 0, total: 0 });
  const [search, setSearch] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState(null); const [creating, setCreating] = useState(false); const [sales, setSales] = useState([]); const [saleId, setSaleId] = useState('');
  const [sale, setSale] = useState(null); const [returnedByLine, setReturnedByLine] = useState({}); const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState(''); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!canRead) { setLoading(false); setItems([]); setError('No tienes permiso para consultar devoluciones.'); return; }
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort: 'createdAt', order: 'desc' });
      if (search.trim()) params.set('search', search.trim());
      const result = await apiRequest(`/api/sales/returns?${params}`);
      setItems(Array.isArray(result.data) ? result.data : []); setPagination(result.pagination || { pages: 0, total: 0 });
    } catch (e) { setError(e.message || 'No se pudieron cargar las devoluciones.'); }
    finally { setLoading(false); }
  }, [canRead, page, search, session?.token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (createFromSaleId && canCreate) { openCreate(); chooseSale(createFromSaleId); }
  }, [createFromSaleId, canCreate]);

  async function openCreate() {
    setCreating(true); setSale(null); setSaleId(''); setReason(''); setNotes(''); setQuantities({}); setError(''); setNotice('');
    try {
      const result = await apiRequest('/api/sales?status=confirmed&page=1&limit=100&sort=createdAt&order=desc');
      setSales(Array.isArray(result.data) ? result.data : []);
    } catch (e) { setError(e.message || 'No se pudieron cargar ventas confirmadas.'); }
  }

  async function chooseSale(id) {
    setSaleId(id); setSale(null); setReturnedByLine({}); setQuantities({}); if (!id) return;
    setError('');
    try {
      const [saleResult, returnsResult] = await Promise.all([
        apiRequest(`/api/sales/${id}`), apiRequest(`/api/sales/returns?saleId=${encodeURIComponent(id)}&page=1&limit=100`)
      ]);
      const returned = {};
      (returnsResult.data || []).forEach(doc => (doc.items || []).forEach(line => { returned[line.saleLineIndex] = (returned[line.saleLineIndex] || 0) + Number(line.quantity); }));
      setSale(saleResult.data); setReturnedByLine(returned);
    } catch (e) { setError(e.message || 'No se pudo consultar la venta y sus devoluciones.'); }
  }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    const returnItems = (sale?.items || []).map((line, saleLineIndex) => ({ line, saleLineIndex, quantity: Number(quantities[saleLineIndex] || 0) }))
      .filter(value => value.quantity > 0).map(({ line, saleLineIndex, quantity }) => ({ productId: line.productId, warehouseId: line.warehouseId, saleLineIndex, quantity }));
    if (!sale || !returnItems.length || !reason.trim()) { setError('Selecciona una venta, captura una cantidad y escribe el motivo.'); setSaving(false); return; }
    try {
      const result = await apiRequest('/api/sales/returns', { method: 'POST', body: JSON.stringify({ saleId: sale.id, reason, notes, items: returnItems }) });
      setNotice(`Devolución ${result.data.folio} procesada.`); setCreating(false); setPage(1); await load();
    } catch (e) { setError(e.message || 'No se pudo procesar la devolución.'); }
    finally { setSaving(false); }
  }

  async function showDetail(item) {
    try { const result = await apiRequest(`/api/sales/returns/${item.id}`); setDetail(result.data); }
    catch (e) { setError(e.message || 'No se pudo consultar el detalle.'); }
  }

  const estimatedTotal = useMemo(() => (sale?.items || []).reduce((sum, line, index) => {
    const qty = Number(quantities[index] || 0); const subtotal = qty * Number(line.unitPrice || 0);
    return sum + subtotal + subtotal * Number(line.taxRate || 0) / 100;
  }, 0), [sale, quantities]);

  if (!canRead) return <p className="card warning-box" role="alert">No tienes permiso para consultar devoluciones.</p>;
  return <>
    {notice ? <p className="inventory-notice" role="status">{notice}</p> : null}
    {error ? <p className="card warning-box" role="alert">{error}</p> : null}
    <section className="card sales-toolbar"><div><h3>Devoluciones persistentes</h3><p>Las devoluciones procesadas reponen inventario y reducen CxC en una transacción.</p></div>{canCreate ? <button className="users-primary-button" onClick={openCreate}>+ Crear devolución</button> : null}</section>
    <section className="card sales-filters"><label>Buscar folio, venta o cliente<input type="search" value={search} onChange={event => { setPage(1); setSearch(event.target.value); }} placeholder="DEV-2026 o VEN-2026" /></label></section>
    {loading ? <div className="card" role="status">Cargando devoluciones…</div> : <section className="card sales-table-card"><table className="data-table"><thead><tr><th>Folio devolución</th><th>Venta</th><th>Cliente</th><th>Fecha</th><th>Motivo</th><th>Total</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
      {!items.length ? <tr><td colSpan="8" className="empty-state">No hay devoluciones para mostrar.</td></tr> : items.map(item => <tr key={item.id}><td><strong>{item.folio}</strong></td><td>{item.sale?.folio || item.saleId}</td><td>{item.customer?.name || item.customerId}</td><td>{new Date(item.processedAt || item.createdAt).toLocaleDateString()}</td><td>{item.reason}</td><td>{money(item.total)}</td><td>Procesada</td><td><button className="secondary" onClick={() => showDetail(item)}>Detalle</button></td></tr>)}
    </tbody></table>{pagination.pages > 1 ? <nav className="inventory-pagination"><span>{pagination.total} devoluciones · Página {page} de {pagination.pages}</span><div><button className="secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</button><button className="secondary" disabled={page >= pagination.pages} onClick={() => setPage(value => value + 1)}>Siguiente</button></div></nav> : null}</section>}
    {creating ? <div className="sales-modal-backdrop"><section className="card sales-modal" role="dialog" aria-modal="true" aria-labelledby="return-create-title"><div className="sales-modal-heading"><div><span className="eyebrow">Nueva operación</span><h3 id="return-create-title">Crear devolución</h3></div><button className="users-icon-button" aria-label="Cerrar" onClick={() => setCreating(false)}>×</button></div>
      <form onSubmit={submit}><label>Venta confirmada<select value={saleId} onChange={event => chooseSale(event.target.value)} required><option value="">Selecciona venta</option>{sales.map(value => <option key={value.id} value={value.id}>{value.folio} · {value.customer?.name || 'Cliente'}</option>)}</select></label>
        {sale ? <><div className="sales-detail-lines"><h4>Partidas disponibles</h4>{sale.items.map((line, index) => { const returned = Number(returnedByLine[index] || 0); const available = Math.max(0, Number(line.quantity) - returned); return <div className="sales-detail-line" key={index}><span><strong>{line.productNameSnapshot}</strong><small>{line.warehouse?.name || line.warehouseId} · vendida {line.quantity} · devuelta {returned} · disponible {available}</small></span><label>Devolver<input aria-label={`Devolver partida ${index + 1}`} type="number" min="0" max={available} step="any" value={quantities[index] || ''} onChange={event => setQuantities(current => ({ ...current, [index]: event.target.value }))} disabled={!available} /></label></div>; })}</div>
          <label>Motivo<input value={reason} onChange={event => setReason(event.target.value)} maxLength="300" required /></label><label>Notas<textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength="1000" rows="3" /></label><div className="sales-form-totals"><span>Total estimado <strong>{money(estimatedTotal)}</strong></span></div><p className="inventory-hint">Precios e impuestos se toman de la venta; el servidor vuelve a comprobar existencias devolvibles.</p></> : null}
        <div className="sales-modal-actions"><button type="button" className="secondary" onClick={() => setCreating(false)} disabled={saving}>Cancelar</button>{sale && canCreate ? <button type="submit" className="users-primary-button" disabled={saving}>{saving ? 'Procesando…' : 'Procesar devolución'}</button> : null}</div>
      </form>
    </section></div> : null}
    {detail ? <div className="sales-modal-backdrop"><section className="card sales-modal" role="dialog" aria-modal="true" aria-labelledby="return-detail-title"><div className="sales-modal-heading"><div><span className="eyebrow">Detalle de devolución</span><h3 id="return-detail-title">{detail.folio}</h3></div><button className="users-icon-button" aria-label="Cerrar" onClick={() => setDetail(null)}>×</button></div><dl className="sales-detail-summary"><div><dt>Venta</dt><dd>{detail.sale?.folio || detail.saleId}</dd></div><div><dt>Cliente</dt><dd>{detail.customer?.name || detail.customerId}</dd></div><div><dt>Motivo</dt><dd>{detail.reason}</dd></div><div><dt>Procesada</dt><dd>{new Date(detail.processedAt).toLocaleString()}</dd></div><div><dt>Usuario</dt><dd>{detail.createdBy?.name || detail.createdBy}</dd></div></dl><div className="sales-detail-lines"><h4>Partidas</h4>{detail.items.map((line, index) => <div className="sales-detail-line" key={index}><span><strong>{line.productNameSnapshot}</strong><small>{line.warehouse?.name || line.warehouseId} · {line.quantity} × {money(line.unitPrice)}</small></span><span>{money(line.total)}</span></div>)}</div>{detail.notes ? <p>{detail.notes}</p> : null}<div className="sales-form-totals"><span>Subtotal <strong>{money(detail.subtotal)}</strong></span><span>Impuestos <strong>{money(detail.taxes)}</strong></span><span>Total <strong>{money(detail.total)}</strong></span></div><div className="sales-modal-actions"><button className="secondary" onClick={() => setDetail(null)}>Cerrar</button></div></section></div> : null}
  </>;
}
