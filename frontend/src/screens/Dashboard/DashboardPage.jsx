import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../services/api';

const shortcuts = [
  { to: '/products', icon: '▦', label: 'Productos y catálogos' },
  { to: '/users', icon: '♙', label: 'Usuarios y accesos' },
  { to: '/audit', icon: '◷', label: 'Registro de auditoría' },
  { to: '/inventory', icon: '▤', label: 'Inventario' }
];
const money = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);

export default function DashboardPage({ session }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest('/api/dashboard').then(response => {
      if (active) setDashboard(response.data);
    }).catch(loadError => {
      if (active) setError(loadError.message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token]);

  const metrics = dashboard?.metrics || {};
  const cards = [
    ['Ventas de hoy', money(metrics.salesToday), `${metrics.salesCountToday || 0} ventas confirmadas`, 'mint'],
    ['Ventas del mes', money(metrics.salesMonth), `${metrics.confirmedSalesCount || 0} ventas confirmadas en total`, 'blue'],
    ['Compras pendientes', metrics.pendingPurchases || 0, 'Órdenes por recibir', 'coral'],
    ['Compras recibidas este mes', metrics.receivedPurchasesMonth || 0, 'Recepciones registradas', 'mint'],
    ['Existencias bajas', metrics.lowStockCount || 0, 'Productos en o bajo mínimo', 'coral'],
    ['Sin existencias', metrics.outOfStockCount || 0, 'Existencia disponible en cero', 'blue'],
    ['Cuentas por cobrar', money(metrics.receivables?.balance), `${metrics.receivables?.count || 0} cuentas abiertas`, 'mint'],
    ['Cuentas por pagar', money(metrics.payables?.balance), `${metrics.payables?.count || 0} cuentas abiertas`, 'coral']
  ];

  return <div className="app-shell dashboard-layout dashboard-page">
    <div className="dashboard-section-heading dashboard-welcome"><div><span className="eyebrow">Panel de control</span><h2>Dashboard ERP</h2><p>Hola, {session?.user?.name || 'usuario'}. Indicadores operativos desde MongoDB.</p></div><Link className="primary-button" to="/reports">Ver reportes</Link></div>
    {error && <div className="card warning-box" role="alert">No se pudo cargar el dashboard: {error}</div>}
    {loading ? <div className="card" role="status">Cargando indicadores operativos...</div> : <>
      <section className="stats-grid" aria-label="Indicadores operativos">
        {cards.map(([label, value, hint, tone]) => <article className={`card stat-card stat-${tone}`} key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>)}
      </section>
      <div className="dashboard-grid dashboard-real-grid">
        <div className="dashboard-primary">
          <section className="card"><div className="dashboard-section-heading"><div><h2>Ventas recientes</h2><p>Últimas ventas confirmadas</p></div></div>
            <div className="table-scroll"><table className="data-table"><thead><tr><th>Folio</th><th>Cliente</th><th>Fecha</th><th>Total</th></tr></thead><tbody>
              {dashboard?.recentSales?.length ? dashboard.recentSales.map(sale => <tr key={sale.id}><td>{sale.folio}</td><td>{sale.customer?.name || 'Cliente'}</td><td>{sale.confirmedAt ? new Date(sale.confirmedAt).toLocaleDateString() : '—'}</td><td>{money(sale.total)}</td></tr>) : <tr><td colSpan="4" className="empty-state">Sin ventas confirmadas.</td></tr>}
            </tbody></table></div>
          </section>
          <section className="card"><div className="dashboard-section-heading"><div><h2>Movimientos financieros recientes</h2><p>Cobros y pagos persistidos</p></div></div>
            <div className="table-scroll"><table className="data-table"><thead><tr><th>Tipo</th><th>Referencia</th><th>Fecha</th><th>Monto</th></tr></thead><tbody>
              {dashboard?.recentFinancialMovements?.length ? dashboard.recentFinancialMovements.map(movement => <tr key={movement.id}><td>{movement.direction === 'IN' ? 'Cobro' : 'Pago'}</td><td>{movement.referenceId?.folio || movement.description}</td><td>{new Date(movement.createdAt).toLocaleDateString()}</td><td>{money(movement.amount)}</td></tr>) : <tr><td colSpan="4" className="empty-state">Sin movimientos financieros.</td></tr>}
            </tbody></table></div>
          </section>
        </div>
        <aside className="dashboard-rail">
          <section className="card rail-card"><div className="rail-heading"><h2>Alertas de inventario</h2><Link to="/inventory">Ver inventario</Link></div>
            {dashboard?.stockAlerts?.length ? <ul className="dashboard-alert-list">{dashboard.stockAlerts.map(alert => <li key={String(alert._id)}><span><strong>{alert.product?.name || 'Producto'}</strong><small>{alert.product?.code} · {alert.warehouse?.name || 'Almacén'}</small></span><b>{Number(alert.availableQuantity ?? (alert.quantity - alert.reservedQuantity))} / {alert.minimumStock}</b></li>)}</ul> : <p className="empty-state">No hay existencias bajo mínimo.</p>}
          </section>
          <section className="card rail-card"><div className="rail-heading"><h2>Accesos rápidos</h2></div><div className="quick-link-list">{shortcuts.map(item => <Link className="quick-link" to={item.to} key={item.to}><span className="quick-link-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span><b aria-hidden="true">›</b></Link>)}</div></section>
        </aside>
      </div>
      <small className="dashboard-updated">Actualizado {dashboard?.generatedAt ? new Date(dashboard.generatedAt).toLocaleString() : ''}</small>
    </>}
  </div>;
}
