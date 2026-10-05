import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';

const labels = { draft: 'Borrador', sent: 'Enviada', accepted: 'Aceptada', rejected: 'Rechazada', converted: 'Convertida', cancelled: 'Cancelada' };
const money = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);
const blankItem = () => ({ productId: '', warehouseId: '', quantity: '1', unitPrice: '', taxRate: '0' });
const has = (user, permission) => Array.isArray(user?.permissions) && user.permissions.includes(permission);

function QuoteForm({ quote, catalogs, onSave, onClose }) {
  const [customerId, setCustomerId] = useState(quote?.customerId || '');
  const [items, setItems] = useState(quote?.items?.map(item => ({ productId: item.productId, warehouseId: item.warehouseId, quantity: String(item.quantity), unitPrice: String(item.unitPrice), taxRate: String(item.taxRate) })) || [blankItem()]);
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const change = (index, key, value) => setItems(current => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || catalogs.products.find(p => p.id === item.productId)?.salePrice || 0), 0);
  const taxes = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || catalogs.products.find(p => p.id === item.productId)?.salePrice || 0) * Number(item.taxRate || 0) / 100, 0);
  async function submit(event) {
    event.preventDefault(); setError(''); setSaving(true);
    try { await onSave({ customerId, items: items.map(item => ({ productId: item.productId, warehouseId: item.warehouseId, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), taxRate: Number(item.taxRate) })) }); }
    catch (e) { setError(e.message || 'No se pudo guardar la cotización.'); } finally { setSaving(false); }
  }
  return <div className="sales-modal-backdrop"><section className="card sales-modal" role="dialog" aria-modal="true" aria-labelledby="quote-form-title">
    <div className="sales-modal-heading"><div><span className="eyebrow">Cotizaciones</span><h3 id="quote-form-title">{quote ? `Editar ${quote.folio}` : 'Nueva cotización'}</h3></div><button type="button" className="users-icon-button" onClick={onClose} aria-label="Cerrar">×</button></div>
    <form onSubmit={submit}><label>Cliente<select required value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">Selecciona un cliente</option>{catalogs.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {items.map((item, i) => <fieldset className="sales-line" key={i}><legend>Partida {i + 1}</legend>
        <label>Producto<select required value={item.productId} onChange={e => { const p = catalogs.products.find(value => value.id === e.target.value); change(i, 'productId', e.target.value); if (p) change(i, 'unitPrice', String(p.salePrice)); }}><option value="">Selecciona producto</option>{catalogs.products.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
        <label>Almacén<select required value={item.warehouseId} onChange={e => change(i, 'warehouseId', e.target.value)}><option value="">Selecciona almacén</option>{catalogs.warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <div className="sales-line-numbers"><label>Cantidad<input type="number" min="0.000001" step="any" required value={item.quantity} onChange={e => change(i, 'quantity', e.target.value)} /></label><label>Precio unitario<input type="number" min="0" step="0.01" required value={item.unitPrice} onChange={e => change(i, 'unitPrice', e.target.value)} /></label><label>Impuesto %<input type="number" min="0" max="100" step="0.01" value={item.taxRate} onChange={e => change(i, 'taxRate', e.target.value)} /></label></div>
        {items.length > 1 ? <button type="button" className="sales-remove-line" onClick={() => setItems(current => current.filter((_, n) => n !== i))}>Quitar partida</button> : null}
      </fieldset>)}
      <button type="button" className="secondary" onClick={() => setItems(current => [...current, blankItem()])}>+ Agregar producto</button>
      <div className="sales-form-totals"><span>Subtotal <strong>{money(subtotal)}</strong></span><span>Impuestos <strong>{money(taxes)}</strong></span><span>Total <strong>{money(subtotal + taxes)}</strong></span></div><p className="inventory-hint">Totales recalculados en el servidor. Crear o convertir cotizaciones no modifica inventario.</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}<div className="sales-modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="users-primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar borrador'}</button></div>
    </form>
  </section></div>;
}

export default function QuotationsPanel({ session, onViewSale }) {
  const user = session?.user; const canRead = has(user, 'sales.read');
  const [items, setItems] = useState([]); const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 }); const [page, setPage] = useState(1);
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null); const [detail, setDetail] = useState(null); const [catalogs, setCatalogs] = useState({ clients: [], products: [], warehouses: [] });
  const query = useMemo(() => new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}), ...(status ? { status } : {}) }).toString(), [page, search, status]);
  async function load() { if (!canRead) { setItems([]); setError('No tienes permiso para consultar cotizaciones.'); return; } setError(''); try { const r = await apiRequest(`/api/sales/quotations?${query}`); setItems(r.data || []); setPagination(r.pagination || { page: 1, pages: 0, total: 0 }); } catch (e) { setError(e.message || 'No se pudieron cargar las cotizaciones.'); } }
  useEffect(() => { load(); }, [canRead, query, session?.token]);
  async function openForm(quote = null) {
    setError(''); try { const [c, p, w] = await Promise.all([apiRequest('/api/clients?status=active&page=1&limit=100'), apiRequest('/api/products?status=active&page=1&limit=100'), apiRequest('/api/inventory/warehouses')]); setCatalogs({ clients: c.data || [], products: p.data || [], warehouses: w.data || [] }); setForm(quote || {}); }
    catch (e) { setError(e.message || 'No se pudieron cargar catálogos.'); }
  }
  async function save(data) { const edit = Boolean(form?.id); await apiRequest(edit ? `/api/sales/quotations/${form.id}` : '/api/sales/quotations', { method: edit ? 'PUT' : 'POST', body: JSON.stringify(data) }); setNotice(edit ? 'Cotización actualizada.' : 'Cotización creada.'); setForm(null); await load(); }
  async function action(quote, name) {
    if (name === 'convert' && !window.confirm('Se creará una venta en estado borrador. El inventario no se modificará hasta confirmar la venta.')) return;
    if (name === 'cancel' && !window.confirm(`¿Cancelar ${quote.folio}?`)) return;
    setBusy(true); setError(''); setNotice(''); try { const r = await apiRequest(`/api/sales/quotations/${quote.id}/${name}`, { method: 'POST', body: JSON.stringify({}) }); setNotice(name === 'convert' ? `Venta ${r.data.sale.folio} creada como borrador.` : r.message || 'Cotización actualizada.'); if (name === 'convert') setDetail({ ...quote, ...r.data.quotation, sale: r.data.sale }); else if (detail?.id === quote.id) setDetail(r.data); await load(); }
    catch (e) { setError(e.message || 'No se pudo completar la acción.'); } finally { setBusy(false); }
  }
  function allowedActions(q) { return <>{q.status === 'draft' && has(user, 'sales.update') ? <button className="secondary" onClick={() => openForm(q)}>Editar</button> : null}{q.status === 'draft' && has(user, 'sales.create') ? <button className="secondary" onClick={() => action(q, 'send')}>Enviar</button> : null}{q.status === 'sent' && has(user, 'sales.update') ? <><button className="secondary" onClick={() => action(q, 'accept')}>Aceptar</button><button className="secondary" onClick={() => action(q, 'reject')}>Rechazar</button></> : null}{q.status === 'draft' && has(user, 'sales.cancel') ? <button className="sales-danger-button" onClick={() => action(q, 'cancel')}>Cancelar</button> : null}{q.status === 'accepted' && has(user, 'sales.create') ? <button className="users-primary-button" disabled={busy} onClick={() => action(q, 'convert')}>Convertir a venta</button> : null}</>; }
  if (!canRead) return <div className="card warning-box" role="alert">No tienes permiso para consultar cotizaciones.</div>;
  return <div className="sales-page">
    {notice ? <p className="inventory-notice" role="status">{notice}</p> : null}{error ? <p className="card warning-box" role="alert">{error}</p> : null}
    <section className="card sales-toolbar"><div><h3>Cotizaciones persistentes</h3><p>Solo una venta confirmada afecta inventario y cuentas por cobrar.</p></div>{has(user, 'sales.create') ? <button className="users-primary-button" onClick={() => openForm()}>+ Nueva cotización</button> : null}</section>
    <section className="card sales-filters"><label>Buscar folio o cliente<input type="search" value={search} onChange={e => { setPage(1); setSearch(e.target.value); }} /></label><label>Estado<select value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}><option value="">Todos</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></section>
    <section className="card sales-table-card"><table className="data-table"><thead><tr><th>Folio</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{items.length ? items.map(q => <tr key={q.id}><td><button className="secondary" onClick={async () => { try { const r = await apiRequest(`/api/sales/quotations/${q.id}`); setDetail(r.data); } catch (e) { setError(e.message); } }}>{q.folio}</button></td><td>{q.customer?.name || q.customerId}</td><td>{new Date(q.createdAt).toLocaleDateString()}</td><td>{money(q.total)}</td><td><span className={`sales-status ${q.status}`}>{labels[q.status]}</span></td><td className="sales-row-actions">{allowedActions(q)}</td></tr>) : <tr><td colSpan="6" className="empty-state">No hay cotizaciones para mostrar.</td></tr>}</tbody></table>
      {pagination.pages > 1 ? <nav className="inventory-pagination"><span>{pagination.total} cotizaciones · Página {page} de {pagination.pages}</span><div><button className="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button><button className="secondary" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Siguiente</button></div></nav> : null}</section>
    {form !== null ? <QuoteForm quote={form?.id ? form : null} catalogs={catalogs} onSave={save} onClose={() => setForm(null)} /> : null}
    {detail ? <div className="sales-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDetail(null); }}><section className="card sales-modal" role="dialog" aria-modal="true"><div className="sales-modal-heading"><div><span className="eyebrow">Detalle de cotización</span><h3>{detail.folio}</h3></div><button className="users-icon-button" onClick={() => setDetail(null)} aria-label="Cerrar">×</button></div><dl className="sales-detail-summary"><div><dt>Cliente</dt><dd>{detail.customer?.name || detail.customerId}</dd></div><div><dt>Estado</dt><dd>{labels[detail.status]}</dd></div><div><dt>Creada</dt><dd>{new Date(detail.createdAt).toLocaleString()}</dd></div>{[['Enviada', detail.sentAt], ['Aceptada', detail.acceptedAt], ['Rechazada', detail.rejectedAt], ['Convertida', detail.convertedAt], ['Cancelada', detail.cancelledAt]].filter(([, date]) => date).map(([label, date]) => <div key={label}><dt>{label}</dt><dd>{new Date(date).toLocaleString()}</dd></div>)}</dl><div className="sales-detail-lines"><h4>Partidas</h4>{detail.items?.map((item, i) => <div className="sales-detail-line" key={i}><span><strong>{item.productNameSnapshot}</strong><small>{item.skuSnapshot} · {item.warehouse?.name || item.warehouseId}</small></span><span>{item.quantity} × {money(item.unitPrice)}<small>Total {money(item.total)}</small></span></div>)}</div><div className="sales-form-totals"><span>Subtotal <strong>{money(detail.subtotal)}</strong></span><span>Impuestos <strong>{money(detail.taxes)}</strong></span><span>Total <strong>{money(detail.total)}</strong></span></div>{detail.sale ? <p role="status">Venta creada: {detail.sale.folio} · Borrador</p> : null}<div className="sales-modal-actions">{detail.sale && has(user, 'sales.read') ? <button className="secondary" onClick={() => onViewSale(detail.sale.id)}>Ver venta</button> : null}{allowedActions(detail)}<button className="secondary" onClick={() => setDetail(null)}>Cerrar</button></div></section></div> : null}
  </div>;
}
