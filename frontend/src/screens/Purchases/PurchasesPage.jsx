import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';

const PAGE_SIZE = 20;
const STATUS_LABELS = { draft: 'Borrador', ordered: 'Ordenada', received: 'Recibida', cancelled: 'Cancelada' };
const can = (user, permission) => Array.isArray(user?.permissions) && user.permissions.includes(permission);
const money = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);
const emptyItem = () => ({ productId: '', warehouseId: '', quantity: '1', unitCost: '', taxRate: '0' });

function PurchaseForm({ suppliers, products, warehouses, loading, loadError, onClose, onCreate }) {
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const updateItem = (index, field, value) => setItems(current => current.map((item, i) => i === index ? { ...item, [field]: value } : item));
  const totals = useMemo(() => items.reduce((result, item) => {
    const product = products.find(value => value.id === item.productId);
    const cost = item.unitCost === '' ? Number(product?.purchasePrice || 0) : Number(item.unitCost);
    const subtotal = Math.round(Number(item.quantity || 0) * cost * 100) / 100;
    result.subtotal += subtotal;
    result.taxes += Math.round(subtotal * Number(item.taxRate || 0)) / 100;
    return result;
  }, { subtotal: 0, taxes: 0 }), [items, products]);
  async function submit(event) {
    event.preventDefault(); setError('');
    if (!supplierId) return setError('Selecciona un proveedor.');
    if (items.some(item => !item.productId || !item.warehouseId || Number(item.quantity) <= 0)) return setError('Completa producto, almacén y cantidad mayor a cero en cada partida.');
    setSaving(true);
    try {
      await onCreate({ supplierId, items: items.map(item => ({ productId: item.productId, warehouseId: item.warehouseId, quantity: Number(item.quantity), ...(item.unitCost === '' ? {} : { unitCost: Number(item.unitCost) }), taxRate: Number(item.taxRate || 0) })) });
    } catch (submitError) { setError(submitError.message || 'No se pudo crear el borrador.'); }
    finally { setSaving(false); }
  }
  return <div className="sales-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="card sales-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-form-title">
      <div className="sales-modal-heading"><div><span className="eyebrow">Nueva operación</span><h3 id="purchase-form-title">Crear borrador de compra</h3></div><button type="button" className="users-icon-button" aria-label="Cerrar" onClick={onClose}>×</button></div>
      {loading ? <p role="status">Cargando proveedores, productos y almacenes…</p> : null}
      {loadError ? <p className="form-error" role="alert">{loadError}</p> : null}
      <form onSubmit={submit}>
        <label>Proveedor<select value={supplierId} onChange={event => setSupplierId(event.target.value)} required><option value="">Selecciona un proveedor</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        <div className="sales-lines-heading"><h4>Productos</h4><button className="secondary" type="button" onClick={() => setItems(current => [...current, emptyItem()])}>+ Agregar producto</button></div>
        {items.map((item, index) => <fieldset className="sales-line" key={index}><legend>Partida {index + 1}</legend>
          <label>Producto<select value={item.productId} onChange={event => { const product = products.find(value => value.id === event.target.value); setItems(current => current.map((line, i) => i === index ? { ...line, productId: event.target.value, unitCost: product ? String(product.purchasePrice) : '' } : line)); }} required><option value="">Selecciona un producto</option>{products.map(product => <option key={product.id} value={product.id}>{product.code} · {product.name}</option>)}</select></label>
          <label>Almacén<select value={item.warehouseId} onChange={event => updateItem(index, 'warehouseId', event.target.value)} required><option value="">Selecciona un almacén</option>{warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
          <div className="sales-line-numbers"><label>Cantidad<input aria-label={`Cantidad partida ${index + 1}`} type="number" min="0.000001" step="any" value={item.quantity} onChange={event => updateItem(index, 'quantity', event.target.value)} required /></label>
            <label>Costo unitario<input aria-label={`Costo partida ${index + 1}`} type="number" min="0" step="0.01" value={item.unitCost} onChange={event => updateItem(index, 'unitCost', event.target.value)} required /></label>
            <label>Impuesto %<input aria-label={`Impuesto partida ${index + 1}`} type="number" min="0" max="100" step="0.01" value={item.taxRate} onChange={event => updateItem(index, 'taxRate', event.target.value)} /></label></div>
          {items.length > 1 ? <button className="sales-remove-line" type="button" onClick={() => setItems(current => current.filter((_, i) => i !== index))}>Quitar partida</button> : null}
        </fieldset>)}
        <div className="sales-form-totals"><span>Subtotal <strong>{money(totals.subtotal)}</strong></span><span>Impuestos <strong>{money(totals.taxes)}</strong></span><span>Total <strong>{money(totals.subtotal + totals.taxes)}</strong></span></div>
        <p className="inventory-hint">Los costos y totales se recalculan en el servidor. El inventario solo aumenta al recibir la compra.</p>
        {error ? <p role="alert" className="form-error">{error}</p> : null}
        <div className="sales-modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cerrar</button><button type="submit" className="users-primary-button" disabled={saving || loading || Boolean(loadError) || !suppliers.length || !products.length || !warehouses.length}>{saving ? 'Guardando…' : 'Crear borrador'}</button></div>
      </form>
    </section>
  </div>;
}

function PurchaseDetails({ purchase, onClose }) {
  return <div className="sales-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="card sales-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-detail-title">
    <div className="sales-modal-heading"><div><span className="eyebrow">Detalle de compra</span><h3 id="purchase-detail-title">{purchase.folio}</h3></div><button type="button" className="users-icon-button" aria-label="Cerrar" onClick={onClose}>×</button></div>
    <dl className="sales-detail-summary"><div><dt>Proveedor</dt><dd>{purchase.supplier?.name || purchase.supplierId}</dd></div><div><dt>Estado</dt><dd>{STATUS_LABELS[purchase.status] || purchase.status}</dd></div><div><dt>Creada</dt><dd>{new Date(purchase.createdAt).toLocaleString()}</dd></div></dl>
    <div className="sales-detail-lines"><h4>Partidas</h4>{purchase.items.map((item, index) => <div className="sales-detail-line" key={`${item.productId}-${index}`}><span><strong>{item.productNameSnapshot}</strong><small>{item.skuSnapshot} · {item.warehouse?.name || item.warehouseId}</small></span><span>{item.quantity} × {money(item.unitCost)}<small>Impuesto {money(item.tax)} · Total {money(item.total)}</small></span></div>)}</div>
    <div className="sales-form-totals"><span>Subtotal <strong>{money(purchase.subtotal)}</strong></span><span>Impuestos <strong>{money(purchase.taxes)}</strong></span><span>Total <strong>{money(purchase.total)}</strong></span></div>
    <div className="sales-modal-actions"><button type="button" className="secondary" onClick={onClose}>Cerrar</button></div>
  </section></div>;
}

export default function PurchasesPage({ session }) {
  const [purchases, setPurchases] = useState([]); const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(false); const [activePurchase, setActivePurchase] = useState(null);
  const [catalogs, setCatalogs] = useState({ suppliers: [], products: [], warehouses: [] }); const [catalogLoading, setCatalogLoading] = useState(false); const [catalogError, setCatalogError] = useState('');
  const user = session?.user; const canRead = can(user, 'purchases.read'); const canCreate = can(user, 'purchases.create');
  const query = useMemo(() => { const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort: 'createdAt', order: 'desc' }); if (search.trim()) params.set('search', search.trim()); if (status) params.set('status', status); return params.toString(); }, [page, search, status]);
  async function loadPurchases() {
    if (!canRead) { setPurchases([]); setLoading(false); setError('No tienes permiso para consultar compras.'); return; }
    setLoading(true); setError('');
    try { const result = await apiRequest(`/api/purchases?${query}`); setPurchases(Array.isArray(result.data) ? result.data : []); setPagination(result.pagination || { page: 1, pages: 0, total: 0 }); }
    catch (loadError) { setError(loadError.message || 'No se pudieron cargar las compras.'); } finally { setLoading(false); }
  }
  useEffect(() => { loadPurchases(); }, [canRead, query, session?.token]);
  async function openCreate() {
    setModal(true); setCatalogLoading(true); setCatalogError('');
    const results = await Promise.allSettled([apiRequest('/api/suppliers?status=active&page=1&limit=100&sort=name&order=asc'), apiRequest('/api/products?status=active&page=1&limit=100&sort=name&order=asc'), apiRequest('/api/inventory/warehouses')]);
    const next = { suppliers: [], products: [], warehouses: [] }; const labels = ['proveedores', 'productos', 'almacenes']; const keys = Object.keys(next); const errors = [];
    results.forEach((result, index) => { if (result.status === 'fulfilled') next[keys[index]] = Array.isArray(result.value.data) ? result.value.data : []; else errors.push(`No se pudieron cargar ${labels[index]}. ${result.reason.message}`); });
    setCatalogs(next); setCatalogError(errors.join(' ')); setCatalogLoading(false);
  }
  async function createPurchase(data) { const result = await apiRequest('/api/purchases', { method: 'POST', body: JSON.stringify(data) }); setNotice(`Borrador ${result.data.folio} creado.`); setModal(false); setPage(1); await loadPurchases(); }
  async function transition(purchase, action) {
    const prompt = action === 'receive' ? `¿Recibir ${purchase.folio}? Se aumentarán las existencias y se registrarán movimientos en una transacción.` : action === 'cancel' ? `¿Cancelar ${purchase.folio}?` : `¿Marcar ${purchase.folio} como ordenada?`;
    if (!window.confirm(prompt)) return;
    setError(''); setNotice('');
    try { const result = await apiRequest(`/api/purchases/${purchase.id}/${action}`, { method: 'POST', body: JSON.stringify({}) }); setNotice(result.message || `Compra ${STATUS_LABELS[result.data?.status] || 'actualizada'}.`); await loadPurchases(); if (activePurchase?.id === purchase.id) setActivePurchase((await apiRequest(`/api/purchases/${purchase.id}`)).data); }
    catch (operationError) { setError(operationError.message || 'No se pudo actualizar la compra.'); }
  }
  async function showDetails(purchase) { try { setActivePurchase((await apiRequest(`/api/purchases/${purchase.id}`)).data); } catch (detailError) { setError(detailError.message || 'No se pudo consultar el detalle.'); } }

  return <div className="app-shell dashboard-layout sales-page purchases-page">
    {notice ? <p className="inventory-notice" role="status">{notice}</p> : null}{error ? <p className="card warning-box" role="alert">{error}</p> : null}
    <section className="card sales-toolbar"><div><h3>Compras persistentes</h3><p>Ordenar no modifica existencias; la recepción suma inventario, movimientos y auditoría en una transacción.</p></div>{canCreate ? <button type="button" className="users-primary-button" onClick={openCreate}>+ Nueva compra</button> : null}</section>
    <section className="card sales-filters" aria-label="Filtros de compras"><label>Buscar folio o proveedor<input type="search" value={search} onChange={event => { setPage(1); setSearch(event.target.value); }} placeholder="COM-2026 o proveedor" /></label><label>Estado<select value={status} onChange={event => { setPage(1); setStatus(event.target.value); }}><option value="">Todos</option><option value="draft">Borrador</option><option value="ordered">Ordenada</option><option value="received">Recibida</option><option value="cancelled">Cancelada</option></select></label></section>
    {loading ? <div className="card" role="status">Cargando compras…</div> : <section className="card sales-table-card"><table className="data-table"><thead><tr><th>Folio</th><th>Proveedor</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {!purchases.length ? <tr><td colSpan="6" className="empty-state">No hay compras para mostrar.</td></tr> : purchases.map(purchase => <tr key={purchase.id}><td><strong>{purchase.folio}</strong></td><td>{purchase.supplier?.name || purchase.supplierId}</td><td>{new Date(purchase.createdAt).toLocaleDateString()}</td><td>{money(purchase.total)}</td><td><span className={`sales-status ${purchase.status}`}>{STATUS_LABELS[purchase.status] || purchase.status}</span></td><td className="sales-row-actions"><button type="button" className="secondary" onClick={() => showDetails(purchase)}>Detalle</button>
        {purchase.status === 'draft' && can(user, 'purchases.approve') ? <button type="button" className="users-primary-button" onClick={() => transition(purchase, 'order')}>Ordenar</button> : null}
        {purchase.status === 'ordered' && can(user, 'purchases.receive') ? <button type="button" className="users-primary-button" onClick={() => transition(purchase, 'receive')}>Recibir</button> : null}
        {['draft', 'ordered'].includes(purchase.status) && can(user, 'purchases.cancel') ? <button type="button" className="sales-danger-button" onClick={() => transition(purchase, 'cancel')}>Cancelar</button> : null}
      </td></tr>)}
    </tbody></table>{pagination.pages > 1 ? <nav className="inventory-pagination" aria-label="Paginación de compras"><span>{pagination.total} compras · Página {pagination.page} de {pagination.pages}</span><div><button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</button><button type="button" className="secondary" disabled={page >= pagination.pages} onClick={() => setPage(value => value + 1)}>Siguiente</button></div></nav> : null}</section>}
    {modal ? <PurchaseForm suppliers={catalogs.suppliers} products={catalogs.products} warehouses={catalogs.warehouses} loading={catalogLoading} loadError={catalogError} onClose={() => setModal(false)} onCreate={createPurchase} /> : null}
    {activePurchase ? <PurchaseDetails purchase={activePurchase} onClose={() => setActivePurchase(null)} /> : null}
  </div>;
}
