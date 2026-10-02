import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';

const PAGE_SIZE = 25;
const MOVEMENT_LABELS = {
  IN: 'Entrada', OUT: 'Salida', ADJUSTMENT: 'Ajuste', TRANSFER_IN: 'Transferencia recibida',
  TRANSFER_OUT: 'Transferencia enviada', SALE: 'Venta', PURCHASE: 'Compra', RETURN: 'Devolución'
};

function allowed(user, permission) {
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}

function InventoryOperationModal({ mode, products, productSearch, onProductSearch, productsLoading, productsError, warehouses, saving, error, onClose, onSubmit }) {
  const [form, setForm] = useState({ productId: '', warehouseId: '', fromWarehouseId: '', toWarehouseId: '', quantity: '', newQuantity: '', reason: '', referenceId: '' });
  const [validationError, setValidationError] = useState('');
  const transfer = mode === 'transfer';
  const adjustment = mode === 'adjustment';

  function update(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
    setValidationError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.productId) return setValidationError('Selecciona un producto.');
    const source = transfer ? form.fromWarehouseId : form.warehouseId;
    if (!source) return setValidationError('Selecciona un almacén.');
    if (transfer && (!form.toWarehouseId || form.toWarehouseId === source)) return setValidationError('Selecciona un almacén destino distinto al origen.');
    const quantity = Number(adjustment ? form.newQuantity : form.quantity);
    if (!Number.isFinite(quantity) || quantity < (adjustment ? 0 : 0.000001)) return setValidationError(adjustment ? 'La existencia objetivo debe ser igual o mayor a cero.' : 'La cantidad debe ser mayor a cero.');
    if (!form.reason.trim()) return setValidationError('El motivo es obligatorio.');
    await onSubmit({ ...form, quantity, newQuantity: quantity });
  }

  const title = { entry: 'Registrar entrada', exit: 'Registrar salida', adjustment: 'Ajustar existencia', transfer: 'Transferir existencias' }[mode];

  return (
    <div className="inventory-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="card inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-modal-title">
        <div className="inventory-modal-heading">
          <div><span className="eyebrow">Existencias persistentes</span><h3 id="inventory-modal-title">{title}</h3></div>
          <button className="users-icon-button" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} noValidate>
          <label>Buscar producto
            <input type="search" value={productSearch} onChange={event => { onProductSearch(event.target.value); setForm(current => ({ ...current, productId: '' })); }} placeholder="Código o nombre" />
          </label>
          <label>Producto
            <select name="productId" value={form.productId} onChange={update} required disabled={!products.length}>
              <option value="">Selecciona un producto</option>
              {products.map(product => <option key={product.id} value={product.id}>{product.code} · {product.name}</option>)}
            </select>
          </label>
          {transfer ? <div className="inventory-form-grid">
            <label>Almacén de origen
              <select name="fromWarehouseId" value={form.fromWarehouseId} onChange={update} required>
                <option value="">Selecciona origen</option>
                {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
            </label>
            <label>Almacén destino
              <select name="toWarehouseId" value={form.toWarehouseId} onChange={update} required>
                <option value="">Selecciona destino</option>
                {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
            </label>
          </div> : <label>Almacén
            <select name="warehouseId" value={form.warehouseId} onChange={update} required>
              <option value="">Selecciona un almacén</option>
              {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
          </label>}
          <label>{adjustment ? 'Existencia objetivo' : 'Cantidad'}
            <input name={adjustment ? 'newQuantity' : 'quantity'} type="number" min={adjustment ? '0' : '0.000001'} step="any" value={adjustment ? form.newQuantity : form.quantity} onChange={update} required />
          </label>
          <label>Motivo
            <input name="reason" value={form.reason} onChange={update} maxLength={500} placeholder="Describe por qué se registra la operación" required />
          </label>
          {!transfer ? <label>Documento relacionado <span className="inventory-optional">(opcional)</span>
            <input name="referenceId" value={form.referenceId} onChange={update} maxLength={120} placeholder="Folio o referencia" />
          </label> : null}
          {productsLoading ? <p className="inventory-hint" role="status">Buscando productos...</p> : null}
          {productsError ? <p className="form-error" role="alert">{productsError}</p> : null}
          {!productsLoading && !productsError && !products.length ? <p className="inventory-hint">No se encontraron productos activos para esta búsqueda.</p> : null}
          {!warehouses.length ? <p className="form-error" role="alert">No hay almacenes activos disponibles.</p> : null}
          {validationError ? <p className="form-error" role="alert">{validationError}</p> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="inventory-modal-actions">
            <button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="users-primary-button" disabled={saving || !products.length || !warehouses.length}>{saving ? 'Procesando...' : 'Confirmar operación'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Pager({ pagination, onPage }) {
  if (!pagination?.pages || pagination.pages <= 1) return null;
  return <nav className="inventory-pagination" aria-label="Paginación">
    <span>{pagination.total} registros · Página {pagination.page} de {pagination.pages}</span>
    <div>
      <button type="button" className="secondary" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Anterior</button>
      <button type="button" className="secondary" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>Siguiente</button>
    </div>
  </nav>;
}

export default function InventoryPage({ session }) {
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [stockPagination, setStockPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, pages: 0 });
  const [movementPagination, setMovementPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, pages: 0 });
  const [stockPage, setStockPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [movementType, setMovementType] = useState('');
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [error, setError] = useState('');
  const [productsError, setProductsError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState('');
  const [operationError, setOperationError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const user = session?.user;
  const canRead = allowed(user, 'inventory.read');
  const canCreate = allowed(user, 'inventory.create');
  const canAdjust = allowed(user, 'inventory.adjust');
  const canOperate = canCreate || canAdjust;

  const stockQuery = useMemo(() => {
    const params = new URLSearchParams({ page: String(stockPage), limit: String(PAGE_SIZE), sort: 'updatedAt', order: 'desc' });
    if (search.trim()) params.set('search', search.trim());
    if (warehouseFilter) params.set('warehouseId', warehouseFilter);
    return params.toString();
  }, [stockPage, search, warehouseFilter]);
  const movementQuery = useMemo(() => {
    const params = new URLSearchParams({ page: String(movementPage), limit: String(PAGE_SIZE), order: 'desc' });
    if (search.trim()) params.set('search', search.trim());
    if (warehouseFilter) params.set('warehouseId', warehouseFilter);
    if (movementType) params.set('type', movementType);
    return params.toString();
  }, [movementPage, search, warehouseFilter, movementType]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [stockResult, movementResult, warehouseResult] = await Promise.all([
          apiRequest(`/api/inventory?${stockQuery}`),
          apiRequest(`/api/inventory/movements?${movementQuery}`),
          apiRequest('/api/inventory/warehouses')
        ]);
        if (!active) return;
        setInventory(Array.isArray(stockResult.data) ? stockResult.data : []);
        setStockPagination(stockResult.pagination || { page: 1, limit: PAGE_SIZE, total: 0, pages: 0 });
        setMovements(Array.isArray(movementResult.data) ? movementResult.data : []);
        setMovementPagination(movementResult.pagination || { page: 1, limit: PAGE_SIZE, total: 0, pages: 0 });
        setWarehouses(Array.isArray(warehouseResult.data) ? warehouseResult.data : []);
      } catch (loadError) {
        if (active) setError(loadError.message || 'No fue posible consultar el inventario.');
      } finally { if (active) setLoading(false); }
    }
    if (canRead) load();
    else { setInventory([]); setMovements([]); setWarehouses([]); setLoading(false); setError('No tienes permiso para consultar inventario.'); }
    return () => { active = false; };
  }, [canRead, stockQuery, movementQuery, reloadCount, session?.token]);

  useEffect(() => {
    let active = true;
    if (!canOperate) { setProducts([]); return () => { active = false; }; }
    setProductsLoading(true);
    setProductsError('');
    const params = new URLSearchParams({ status: 'active', page: '1', limit: '100', sort: 'name', order: 'asc' });
    if (productSearch.trim()) params.set('search', productSearch.trim());
    apiRequest(`/api/products?${params.toString()}`)
      .then(payload => { if (active) setProducts(Array.isArray(payload.data) ? payload.data : []); })
      .catch(loadError => { if (active) setProductsError(loadError.message || 'No se pudieron cargar productos.'); })
      .finally(() => { if (active) setProductsLoading(false); });
    return () => { active = false; };
  }, [canOperate, productSearch, session?.token]);

  async function submitOperation(data) {
    setSaving(true);
    setOperationError('');
    try {
      let path;
      let payload;
      if (modal === 'entry' || modal === 'exit') {
        path = `/api/inventory/${modal}`;
        payload = { productId: data.productId, warehouseId: data.warehouseId, quantity: data.quantity, reason: data.reason.trim(), referenceType: 'manual', referenceId: data.referenceId.trim() };
      } else if (modal === 'adjustment') {
        path = '/api/inventory/adjust';
        payload = { productId: data.productId, warehouseId: data.warehouseId, newQuantity: data.newQuantity, reason: data.reason.trim(), referenceType: 'manual', referenceId: data.referenceId.trim() };
      } else {
        path = '/api/inventory/transfer';
        payload = { productId: data.productId, fromWarehouseId: data.fromWarehouseId, toWarehouseId: data.toWarehouseId, quantity: data.quantity, reason: data.reason.trim() };
      }
      const result = await apiRequest(path, { method: 'POST', body: JSON.stringify(payload) });
      setModal('');
      setNotice(result.message || 'Operación de inventario realizada correctamente.');
      setReloadCount(count => count + 1);
    } catch (requestError) { setOperationError(requestError.message || 'No fue posible registrar la operación.'); }
    finally { setSaving(false); }
  }

  function changeFilters(callback) {
    setStockPage(1);
    setMovementPage(1);
    callback();
  }

  const productLabel = item => item.product?.name || item.product?.code || item.productId;
  const warehouseLabel = item => item.warehouse?.name || item.warehouseId;
  const dateLabel = value => value ? new Date(value).toLocaleString() : '—';

  return (
    <div className="app-shell dashboard-layout inventory-page">
      {notice ? <div className="inventory-notice" role="status">{notice}</div> : null}
      {error ? <div className="card warning-box" role="alert">{error}</div> : null}
      {productsError && canOperate ? <div className="card warning-box" role="alert">No se pueden crear movimientos: {productsError}</div> : null}
      <section className="card inventory-toolbar">
        <div><h3>Existencias por almacén</h3><p>Las entradas, salidas, ajustes y transferencias generan movimientos auditables.</p></div>
        <div className="inventory-actions">
          {canCreate ? <>
            <button type="button" className="users-primary-button" disabled={Boolean(productsError)} onClick={() => { setOperationError(''); setProductSearch(''); setModal('entry'); }}>+ Entrada</button>
            <button type="button" className="secondary" disabled={Boolean(productsError)} onClick={() => { setOperationError(''); setProductSearch(''); setModal('exit'); }}>− Salida</button>
          </> : null}
          {canAdjust ? <>
            <button type="button" className="secondary" disabled={Boolean(productsError)} onClick={() => { setOperationError(''); setProductSearch(''); setModal('adjustment'); }}>Ajustar</button>
            <button type="button" className="secondary" disabled={Boolean(productsError) || warehouses.length < 2} onClick={() => { setOperationError(''); setProductSearch(''); setModal('transfer'); }}>Transferir</button>
          </> : null}
        </div>
      </section>
      {canOperate && productsLoading && !modal ? <p className="inventory-hint" role="status">Cargando productos disponibles...</p> : null}

      <section className="card inventory-filters" aria-label="Filtros de inventario">
        <label>Producto
          <input type="search" value={search} onChange={event => changeFilters(() => setSearch(event.target.value))} placeholder="Buscar por código o nombre" />
        </label>
        <label>Almacén
          <select value={warehouseFilter} onChange={event => changeFilters(() => setWarehouseFilter(event.target.value))}>
            <option value="">Todos los almacenes</option>
            {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
          </select>
        </label>
      </section>

      {loading ? <div className="card">Cargando inventario y movimientos...</div> : <>
        {!canRead ? null : <>
          <section className="card inventory-table-card">
            <table className="data-table">
              <thead><tr><th>Producto</th><th>Almacén</th><th>Existencia</th><th>Reservado</th><th>Disponible</th><th>Mínimo</th><th>Estado</th></tr></thead>
              <tbody>{inventory.length ? inventory.map(item => <tr key={item.id}>
                <td>{productLabel(item)}</td><td>{warehouseLabel(item)}</td><td>{item.quantity}</td><td>{item.reservedQuantity}</td><td>{item.availableQuantity}</td><td>{item.minimumStock}</td>
                <td><span className={`inventory-stock-state ${item.status === 'low' ? 'low' : 'available'}`}>{item.status === 'low' ? 'Stock bajo' : 'Disponible'}</span></td>
              </tr>) : <tr><td colSpan="7" className="empty-state">No hay existencias que coincidan con los filtros.</td></tr>}</tbody>
            </table>
          </section>
          <Pager pagination={stockPagination} onPage={setStockPage} />

          <section className="card inventory-history-heading">
            <div><h3>Movimientos de inventario</h3><p>Historial inmutable de cambios de existencia.</p></div>
            <label>Tipo de movimiento
              <select value={movementType} onChange={event => changeFilters(() => setMovementType(event.target.value))}>
                <option value="">Todos</option>
                {Object.entries(MOVEMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </section>
          <section className="card inventory-table-card">
            <table className="data-table">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Almacén</th><th>Cantidad</th><th>Antes</th><th>Después</th><th>Motivo</th><th>Usuario</th></tr></thead>
              <tbody>{movements.length ? movements.map(item => <tr key={item.id}>
                <td>{dateLabel(item.createdAt)}</td><td>{MOVEMENT_LABELS[item.type] || item.type}</td><td>{productLabel(item)}</td><td>{warehouseLabel(item)}</td><td>{item.quantity}</td><td>{item.previousQuantity}</td><td>{item.newQuantity}</td><td>{item.reason}</td><td>{item.user?.name || item.userId}</td>
              </tr>) : <tr><td colSpan="9" className="empty-state">Aún no hay movimientos registrados.</td></tr>}</tbody>
            </table>
          </section>
          <Pager pagination={movementPagination} onPage={setMovementPage} />
        </>}
      </>}

      {modal ? <InventoryOperationModal mode={modal} products={products} productSearch={productSearch} onProductSearch={setProductSearch} productsLoading={productsLoading} productsError={productsError} warehouses={warehouses} saving={saving} error={operationError} onClose={() => setModal('')} onSubmit={submitOperation} /> : null}
    </div>
  );
}
