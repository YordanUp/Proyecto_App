import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';

const PAGE_SIZE = 20;
const STATUS_LABELS = { draft: 'Borrador', confirmed: 'Confirmada', cancelled: 'Cancelada' };

function can(user, permission) {
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}

function money(value) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);
}

function emptyItem() {
  return { productId: '', warehouseId: '', quantity: '1', unitPrice: '', taxRate: '0' };
}

function SaleForm({ clients, products, warehouses, loading, loadError, onClose, onCreate }) {
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function updateItem(index, field, value) {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  const totals = useMemo(() => items.reduce((result, item) => {
    const product = products.find(value => value.id === item.productId);
    const unitPrice = item.unitPrice === '' ? Number(product?.salePrice || 0) : Number(item.unitPrice);
    const lineSubtotal = Math.round(Number(item.quantity || 0) * unitPrice * 100) / 100;
    const tax = Math.round(lineSubtotal * Number(item.taxRate || 0)) / 100;
    result.subtotal += lineSubtotal;
    result.taxes += tax;
    return result;
  }, { subtotal: 0, taxes: 0 }), [items, products]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!customerId) return setError('Selecciona un cliente.');
    if (!items.length || items.some(item => !item.productId || !item.warehouseId || Number(item.quantity) <= 0)) return setError('Completa producto, almacén y cantidad mayor a cero en cada partida.');
    setSaving(true);
    try {
      await onCreate({ customerId, items: items.map(item => ({
        productId: item.productId, warehouseId: item.warehouseId, quantity: Number(item.quantity),
        ...(item.unitPrice === '' ? {} : { unitPrice: Number(item.unitPrice) }), taxRate: Number(item.taxRate || 0)
      })) });
    } catch (createError) { setError(createError.message || 'No se pudo crear el borrador.'); }
    finally { setSaving(false); }
  }

  return <div className="sales-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="card sales-modal" role="dialog" aria-modal="true" aria-labelledby="sales-form-title">
      <div className="sales-modal-heading"><div><span className="eyebrow">Nueva operación</span><h3 id="sales-form-title">Crear borrador de venta</h3></div><button type="button" className="users-icon-button" aria-label="Cerrar" onClick={onClose}>×</button></div>
      {loading ? <p role="status">Cargando clientes, productos y almacenes…</p> : null}
      {loadError ? <p className="form-error" role="alert">{loadError}</p> : null}
      <form onSubmit={submit}>
        <label>Cliente
          <select value={customerId} onChange={event => setCustomerId(event.target.value)} required>
            <option value="">Selecciona un cliente</option>
            {clients.map(client => <option value={client.id} key={client.id}>{client.name}{client.email ? ` · ${client.email}` : ''}</option>)}
          </select>
        </label>
        <div className="sales-lines-heading"><h4>Productos</h4><button className="secondary" type="button" onClick={() => setItems(current => [...current, emptyItem()])}>+ Agregar producto</button></div>
        {items.map((item, index) => {
          const selected = products.find(product => product.id === item.productId);
          return <fieldset className="sales-line" key={index}>
            <legend>Partida {index + 1}</legend>
            <label>Producto
              <select value={item.productId} onChange={event => {
                const product = products.find(value => value.id === event.target.value);
                setItems(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, productId: event.target.value, unitPrice: product ? String(product.salePrice) : '' } : line));
              }} required>
                <option value="">Selecciona un producto</option>
                {products.map(product => <option value={product.id} key={product.id}>{product.code} · {product.name}</option>)}
              </select>
            </label>
            <label>Almacén
              <select value={item.warehouseId} onChange={event => updateItem(index, 'warehouseId', event.target.value)} required>
                <option value="">Selecciona un almacén</option>
                {warehouses.map(warehouse => <option value={warehouse.id} key={warehouse.id}>{warehouse.name}</option>)}
              </select>
            </label>
            <div className="sales-line-numbers">
              <label>Cantidad<input aria-label={`Cantidad partida ${index + 1}`} type="number" min="0.000001" step="any" value={item.quantity} onChange={event => updateItem(index, 'quantity', event.target.value)} required /></label>
              <label>Precio unitario<input aria-label={`Precio partida ${index + 1}`} type="number" min={selected?.purchasePrice || 0} step="0.01" value={item.unitPrice === '' && selected ? selected.salePrice : item.unitPrice} onChange={event => updateItem(index, 'unitPrice', event.target.value)} required /></label>
              <label>Impuesto %<input aria-label={`Impuesto partida ${index + 1}`} type="number" min="0" max="100" step="0.01" value={item.taxRate} onChange={event => updateItem(index, 'taxRate', event.target.value)} /></label>
            </div>
            {items.length > 1 ? <button type="button" className="sales-remove-line" onClick={() => setItems(current => current.filter((_, lineIndex) => lineIndex !== index))}>Quitar partida</button> : null}
          </fieldset>;
        })}
        <div className="sales-form-totals"><span>Subtotal <strong>{money(totals.subtotal)}</strong></span><span>Impuestos <strong>{money(totals.taxes)}</strong></span><span>Total <strong>{money(totals.subtotal + totals.taxes)}</strong></span></div>
        <p className="inventory-hint">El precio y los totales se recalculan y validan en el servidor. El inventario solo cambia al confirmar.</p>
        {error ? <p role="alert" className="form-error">{error}</p> : null}
        <div className="sales-modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="users-primary-button" disabled={saving || loading || Boolean(loadError) || !clients.length || !products.length || !warehouses.length}>{saving ? 'Guardando…' : 'Crear borrador'}</button></div>
      </form>
    </section>
  </div>;
}

function SaleDetails({ sale, onClose }) {
  return <div className="sales-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="card sales-modal" role="dialog" aria-modal="true" aria-labelledby="sale-detail-title">
      <div className="sales-modal-heading"><div><span className="eyebrow">Detalle de venta</span><h3 id="sale-detail-title">{sale.folio}</h3></div><button type="button" className="users-icon-button" aria-label="Cerrar" onClick={onClose}>×</button></div>
      <dl className="sales-detail-summary"><div><dt>Cliente</dt><dd>{sale.customer?.name || sale.customerId}</dd></div><div><dt>Estado</dt><dd>{STATUS_LABELS[sale.status] || sale.status}</dd></div><div><dt>Creada</dt><dd>{new Date(sale.createdAt).toLocaleString()}</dd></div></dl>
      <div className="sales-detail-lines"><h4>Partidas</h4>{sale.items.map((item, index) => <div className="sales-detail-line" key={`${item.productId}-${index}`}><span><strong>{item.productNameSnapshot}</strong><small>{item.skuSnapshot} · {item.warehouse?.name || item.warehouseId}</small></span><span>{item.quantity} × {money(item.unitPrice)}<small>Impuesto {money(item.tax)} · Total {money(item.total)}</small></span></div>)}</div>
      <div className="sales-form-totals"><span>Subtotal <strong>{money(sale.subtotal)}</strong></span><span>Impuestos <strong>{money(sale.taxes)}</strong></span><span>Total <strong>{money(sale.total)}</strong></span></div>
      <div className="sales-modal-actions"><button type="button" className="secondary" onClick={onClose}>Cerrar</button></div>
    </section>
  </div>;
}

export default function SalesPage({ session }) {
  const [sales, setSales] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState('');
  const [activeSale, setActiveSale] = useState(null);
  const [catalogs, setCatalogs] = useState({ clients: [], products: [], warehouses: [] });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const user = session?.user;
  const canRead = can(user, 'sales.read');
  const canCreate = can(user, 'sales.create');
  const canCancel = can(user, 'sales.cancel');

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort: 'createdAt', order: 'desc' });
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    return params.toString();
  }, [page, search, status]);

  async function loadSales() {
    if (!canRead) { setSales([]); setLoading(false); setError('No tienes permiso para consultar ventas.'); return; }
    setLoading(true); setError('');
    try {
      const result = await apiRequest(`/api/sales?${query}`);
      setSales(Array.isArray(result.data) ? result.data : []);
      setPagination(result.pagination || { page: 1, pages: 0, total: 0 });
    } catch (loadError) { setError(loadError.message || 'No se pudieron cargar las ventas.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadSales(); }, [canRead, query, session?.token]);

  async function openCreate() {
    setModal('create'); setCatalogLoading(true); setCatalogError('');
    const results = await Promise.allSettled([
      apiRequest('/api/clients?status=active&page=1&limit=100&sort=name&order=asc'),
      apiRequest('/api/products?status=active&page=1&limit=100&sort=name&order=asc'),
      apiRequest('/api/inventory/warehouses')
    ]);
    const labels = ['clientes', 'productos', 'almacenes'];
    const next = { clients: [], products: [], warehouses: [] };
    const keys = ['clients', 'products', 'warehouses'];
    const errors = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') next[keys[index]] = Array.isArray(result.value.data) ? result.value.data : [];
      else errors.push(`No se pudieron cargar ${labels[index]}. ${result.reason.message}`);
    });
    setCatalogs(next); setCatalogError(errors.join(' ')); setCatalogLoading(false);
  }

  async function createSale(data) {
    const result = await apiRequest('/api/sales', { method: 'POST', body: JSON.stringify(data) });
    setNotice(`Borrador ${result.data.folio} creado.`); setModal(''); setPage(1); await loadSales();
  }

  async function transition(sale, action) {
    const isConfirm = action === 'confirm';
    const prompt = isConfirm
      ? `¿Confirmar ${sale.folio}? Se descontará inventario de forma transaccional.`
      : `¿Cancelar ${sale.folio}?${sale.status === 'confirmed' ? ' Se revertirá el inventario.' : ''}`;
    if (!window.confirm(prompt)) return;
    setError(''); setNotice('');
    try {
      const result = await apiRequest(`/api/sales/${sale.id}/${action}`, { method: 'POST', body: JSON.stringify({}) });
      setNotice(result.message || `Venta ${isConfirm ? 'confirmada' : 'cancelada'} correctamente.`);
      await loadSales();
      if (activeSale?.id === sale.id) {
        const detail = await apiRequest(`/api/sales/${sale.id}`);
        setActiveSale(detail.data);
      }
    } catch (operationError) { setError(operationError.message || 'No se pudo actualizar la venta.'); }
  }

  async function showDetails(sale) {
    try { const result = await apiRequest(`/api/sales/${sale.id}`); setActiveSale(result.data); }
    catch (detailError) { setError(detailError.message || 'No se pudo consultar el detalle.'); }
  }

  return <div className="app-shell dashboard-layout sales-page">
    {notice ? <p className="inventory-notice" role="status">{notice}</p> : null}
    {error ? <p className="card warning-box" role="alert">{error}</p> : null}
    <section className="card sales-toolbar"><div><h3>Ventas persistentes</h3><p>Los borradores no afectan existencias; confirmar y cancelar registran sus movimientos en una transacción.</p></div>{canCreate ? <button type="button" className="users-primary-button" onClick={openCreate}>+ Nueva venta</button> : null}</section>
    <section className="card sales-filters" aria-label="Filtros de ventas">
      <label>Buscar folio o cliente<input type="search" value={search} onChange={event => { setPage(1); setSearch(event.target.value); }} placeholder="VEN-2026 o nombre" /></label>
      <label>Estado<select value={status} onChange={event => { setPage(1); setStatus(event.target.value); }}><option value="">Todos</option><option value="draft">Borrador</option><option value="confirmed">Confirmada</option><option value="cancelled">Cancelada</option></select></label>
    </section>
    {loading ? <div className="card" role="status">Cargando ventas…</div> : <section className="card sales-table-card"><table className="data-table"><thead><tr><th>Folio</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {!sales.length ? <tr><td colSpan="6" className="empty-state">No hay ventas para mostrar.</td></tr> : sales.map(sale => <tr key={sale.id}>
        <td><strong>{sale.folio}</strong></td><td>{sale.customer?.name || sale.customerId}</td><td>{new Date(sale.createdAt).toLocaleDateString()}</td><td>{money(sale.total)}</td>
        <td><span className={`sales-status ${sale.status}`}>{STATUS_LABELS[sale.status] || sale.status}</span></td>
        <td className="sales-row-actions"><button type="button" className="secondary" onClick={() => showDetails(sale)}>Detalle</button>
          {sale.status === 'draft' && canCreate ? <button type="button" className="users-primary-button" onClick={() => transition(sale, 'confirm')}>Confirmar</button> : null}
          {sale.status !== 'cancelled' && canCancel ? <button type="button" className="sales-danger-button" onClick={() => transition(sale, 'cancel')}>Cancelar</button> : null}
        </td>
      </tr>)}
    </tbody></table>
      {pagination.pages > 1 ? <nav className="inventory-pagination" aria-label="Paginación de ventas"><span>{pagination.total} ventas · Página {pagination.page} de {pagination.pages}</span><div><button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</button><button type="button" className="secondary" disabled={page >= pagination.pages} onClick={() => setPage(value => value + 1)}>Siguiente</button></div></nav> : null}
    </section>}
    {modal === 'create' ? <SaleForm clients={catalogs.clients} products={catalogs.products} warehouses={catalogs.warehouses} loading={catalogLoading} loadError={catalogError} onClose={() => setModal('')} onCreate={createSale} /> : null}
    {activeSale ? <SaleDetails sale={activeSale} onClose={() => setActiveSale(null)} /> : null}
  </div>;
}
