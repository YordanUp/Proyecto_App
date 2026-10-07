import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL, apiRequest } from '../../services/api';

const REPORT_OPTIONS = [
  ['sales', 'Ventas'], ['sales-returns', 'Devoluciones de ventas'], ['purchases', 'Compras'], ['inventory-stock', 'Existencias'],
  ['inventory-movements', 'Movimientos de inventario'], ['receivables', 'Cuentas por cobrar'],
  ['payables', 'Cuentas por pagar'], ['finance-movements', 'Movimientos financieros']
];
const formatValue = (value, key) => {
  if (value == null || value === '') return '—';
  if (key === 'type' && value === 'SALE_RETURN') return 'Devolución de venta';
  if (typeof value === 'object') return value.name || value.folio || value.code || value.email || '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString();
  return String(value);
};
const columnLabel = key => ({ _id: 'ID', folio: 'Folio', sale: 'Folio de venta', customer: 'Cliente', supplier: 'Proveedor', productId: 'Producto', warehouseId: 'Almacén', originalAmount: 'Monto original', paidAmount: 'Pagado', balance: 'Saldo', createdAt: 'Fecha', processedAt: 'Fecha de devolución', confirmedAt: 'Confirmación', receivedAt: 'Recepción', quantity: 'Existencia', reservedQuantity: 'Reservado', minimumStock: 'Mínimo', type: 'Tipo', direction: 'Dirección', amount: 'Monto', status: 'Estado', reason: 'Motivo', subtotal: 'Subtotal', taxes: 'Impuestos', total: 'Total', grossSubtotal: 'Subtotal bruto', grossTaxes: 'Impuestos brutos', grossTotal: 'Total bruto', returnedSubtotal: 'Subtotal devuelto', returnedTaxes: 'Impuestos devueltos', returnedTotal: 'Total devuelto', netSubtotal: 'Subtotal neto', netTaxes: 'Impuestos netos', netTotal: 'Total neto', returnsSubtotal: 'Subtotal devuelto', returnsTaxes: 'Impuestos devueltos', returnsTotal: 'Total devuelto' }[key] || key);

export default function ReportsPage() {
  const [type, setType] = useState('sales');
  const [filters, setFilters] = useState({ from: '', to: '', status: '', search: '', customer: '', saleId: '', supplier: '', product: '', warehouse: '', movementType: '', lowStock: false });
  const [page, setPage] = useState(1);
  const [report, setReport] = useState({ items: [], pagination: { page: 1, limit: 25, total: 0, pages: 0 }, totals: {} });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const applicable = useMemo(() => ({
    status: ['sales', 'purchases', 'receivables', 'payables'].includes(type),
    dates: true, from: true, to: true,
    party: ['sales', 'sales-returns', 'purchases', 'receivables', 'payables', 'finance-movements'].includes(type),
    customer: ['sales', 'sales-returns', 'receivables', 'finance-movements'].includes(type),
    supplier: ['purchases', 'payables', 'finance-movements'].includes(type),
    sale: type === 'sales-returns',
    saleId: type === 'sales-returns',
    product: ['sales', 'purchases', 'inventory-stock', 'inventory-movements'].includes(type),
    warehouse: ['sales', 'purchases', 'inventory-stock', 'inventory-movements'].includes(type),
    movement: ['inventory-movements', 'finance-movements'].includes(type),
    lowStock: type === 'inventory-stock',
    search: type !== 'inventory-stock'
  }), [type]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      for (const [key, value] of Object.entries(filters)) {
        if (value && key !== 'lowStock' && applicable[key]) params.set(type === 'sales-returns' && key === 'customer' ? 'customerId' : key, value);
        if (key === 'lowStock' && value) params.set(key, 'true');
      }
      const payload = await apiRequest(`/api/reports/data/${type}?${params}`);
      setReport({ items: payload.data || [], pagination: payload.pagination || { page, limit: 25, total: 0, pages: 0 }, totals: payload.totals || {} });
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [type, page, filters, applicable]);

  useEffect(() => { load(); }, [load]);
  const columns = useMemo(() => {
    if (type === 'sales') return ['folio', 'status', 'customer', 'grossSubtotal', 'grossTaxes', 'grossTotal', 'returnedSubtotal', 'returnedTaxes', 'returnedTotal', 'netSubtotal', 'netTaxes', 'netTotal', 'confirmedAt'];
    if (type === 'sales-returns') return ['folio', 'sale', 'customer', 'processedAt', 'reason', 'subtotal', 'taxes', 'total'];
    return [...new Set(report.items.flatMap(item => Object.keys(item).filter(key => !['_id', '__v', 'id'].includes(key))))];
  }, [report.items, type]);
  const updateFilter = (key, value) => { setPage(1); setFilters(current => ({ ...current, [key]: value })); };

  async function exportCsv() {
    setExporting(true); setError(''); setNotice('');
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value && key !== 'lowStock' && applicable[key]) params.set(type === 'sales-returns' && key === 'customer' ? 'customerId' : key, value);
        if (key === 'lowStock' && value) params.set(key, 'true');
      }
      const token = localStorage.getItem('erp_token');
      const response = await fetch(`${API_URL}/api/reports/data/${type}/export.csv?${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'No se pudo exportar el reporte.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${type}.csv`; anchor.click(); URL.revokeObjectURL(url);
      setNotice('CSV exportado y registrado en auditoría.');
    } catch (exportError) { setError(exportError.message); }
    finally { setExporting(false); }
  }

  return <div className="app-shell dashboard-layout reports-page">
    <div className="dashboard-section-heading dashboard-welcome"><div><span className="eyebrow">Análisis operativo</span><h2>Reportes</h2><p>Consulta datos persistidos y exporta el resultado filtrado.</p></div><button className="primary-button" type="button" onClick={exportCsv} disabled={exporting || loading}>{exporting ? 'Exportando…' : 'Exportar CSV'}</button></div>
    <section className="card report-filters" aria-label="Filtros del reporte">
      <label>Reporte<select value={type} onChange={event => { setType(event.target.value); setPage(1); }} aria-label="Tipo de reporte">{REPORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {applicable.dates && <><label>Desde<input type="date" value={filters.from} onChange={event => updateFilter('from', event.target.value)} /></label><label>Hasta<input type="date" value={filters.to} onChange={event => updateFilter('to', event.target.value)} /></label></>}
      {applicable.status && <label>Estado<select value={filters.status} onChange={event => updateFilter('status', event.target.value)}><option value="">Todos</option>{(type === 'sales' ? ['draft', 'confirmed', 'cancelled'] : type === 'purchases' ? ['draft', 'ordered', 'received', 'cancelled'] : ['pending', 'partial', 'paid', 'cancelled']).map(value => <option key={value}>{value}</option>)}</select></label>}
      {applicable.party && (type === 'sales' || type === 'receivables' || type === 'finance-movements') && <label>Cliente<input value={filters.customer} onChange={event => updateFilter('customer', event.target.value)} placeholder="Nombre o ObjectId" /></label>}
      {applicable.party && type === 'sales-returns' && <label>Cliente<input value={filters.customer} onChange={event => updateFilter('customer', event.target.value)} placeholder="Nombre o ObjectId" /></label>}
      {applicable.sale && <label>Venta<input value={filters.saleId} onChange={event => updateFilter('saleId', event.target.value)} placeholder="ObjectId de venta" /></label>}
      {applicable.party && (type === 'purchases' || type === 'payables' || type === 'finance-movements') && <label>Proveedor<input value={filters.supplier} onChange={event => updateFilter('supplier', event.target.value)} placeholder="Nombre o ObjectId" /></label>}
      {applicable.product && <label>Producto<input value={filters.product} onChange={event => updateFilter('product', event.target.value)} placeholder="Nombre o ObjectId" /></label>}
      {applicable.warehouse && <label>Almacén<input value={filters.warehouse} onChange={event => updateFilter('warehouse', event.target.value)} placeholder="Nombre o ObjectId" /></label>}
      {applicable.movement && <label>Tipo de movimiento<select value={filters.movementType} onChange={event => updateFilter('movementType', event.target.value)}><option value="">Todos</option>{(type === 'finance-movements' ? ['RECEIVABLE_PAYMENT', 'PAYABLE_PAYMENT'] : ['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'SALE', 'PURCHASE', 'RETURN', 'SALE_RETURN']).map(value => <option key={value} value={value}>{value === 'SALE_RETURN' ? 'Devolución de venta' : value}</option>)}</select></label>}
      {applicable.search && <label className="report-search">Buscar<input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Folio, producto o descripción" /></label>}
      {applicable.lowStock && <label className="report-checkbox"><input type="checkbox" checked={filters.lowStock} onChange={event => updateFilter('lowStock', event.target.checked)} /> Solo bajo mínimo</label>}
    </section>
    {error && <div className="card warning-box" role="alert">{error}</div>}{notice && <div className="card success-box" role="status">{notice}</div>}
    <section className="card report-results"><div className="dashboard-section-heading"><div><h3>{REPORT_OPTIONS.find(([value]) => value === type)?.[1]}</h3><p>{report.pagination.total} registros encontrados</p></div></div>
      {Object.keys(report.totals).length > 0 && <div className="report-totals">{Object.entries(report.totals).map(([key, value]) => <div key={key}><span>{columnLabel(key)}</span><strong>{typeof value === 'number' && /Amount|total|taxes|subtotal|balance|amount/i.test(key) ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value) : value}</strong></div>)}</div>}
      {type === 'sales' ? <p className="report-period-note">Totales financieros: ventas confirmadas por fecha de venta menos devoluciones procesadas en el periodo. Un pago reduce CxC, no las ventas netas.</p> : null}
      <div className="table-scroll"><table className="data-table"><thead><tr>{columns.map(column => <th key={column}>{columnLabel(column)}</th>)}</tr></thead><tbody>
        {loading ? <tr><td colSpan={Math.max(columns.length, 1)} className="empty-state">Cargando datos…</td></tr> : report.items.length ? report.items.map(item => <tr key={item.id}>{columns.map(column => <td key={column}>{formatValue(item[column], column)}</td>)}</tr>) : <tr><td colSpan={Math.max(columns.length, 1)} className="empty-state">No hay datos para los filtros seleccionados.</td></tr>}
      </tbody></table></div>
      <div className="report-pagination"><span>Página {report.pagination.page} de {Math.max(report.pagination.pages, 1)}</span><div><button type="button" className="secondary-button" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</button><button type="button" className="secondary-button" disabled={loading || page >= report.pagination.pages} onClick={() => setPage(value => value + 1)}>Siguiente</button></div></div>
    </section>
  </div>;
}
