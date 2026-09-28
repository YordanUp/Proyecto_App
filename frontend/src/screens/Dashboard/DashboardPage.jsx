import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function DashboardPage({ session }) {
  const [metrics, setMetrics] = useState(null);
  const [chart, setChart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        const token = session?.token;
        if (!token) {
          setError('Sesión no disponible.');
          setLoading(false);
          return;
        }
        const response = await fetch(API_URL + '/api/dashboard', {
          headers: { Authorization: 'Bearer ' + token }
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'No se pudo cargar el dashboard');
        }
        setMetrics(payload.data?.metrics || null);
        setChart(payload.data?.chart || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [session]);

  const maxChartValue = Math.max(...chart.map((item) => Number(item.value) || 0), 1);

  return (
    <div className="app-shell dashboard-layout">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Resumen ejecutivo</span>
          <h1>Panel principal</h1>
          <p>Consulta el estado de las operaciones del ERP desde un solo lugar.</p>
        </div>
        <div className="heading-actions">
          <Link to="/reports" className="primary-action">Ver reportes</Link>
          <Link to="/products" className="secondary-action">Catálogo</Link>
        </div>
      </header>

      {error ? <div className="card warning-box">{error}</div> : null}

      {loading ? <div className="card loading-card">Cargando indicadores...</div> : (
        <>
          <section className="stats-grid">
            <article className="card metric-card">
              <div className="metric-top"><span>Ventas</span><span className="metric-icon">↗</span></div>
              <strong>{metrics?.totalSales ? '$' + metrics.totalSales.toLocaleString() : '$0'}</strong>
              <small>Acumulado registrado</small>
            </article>
            <article className="card metric-card">
              <div className="metric-top"><span>Compras</span><span className="metric-icon">↙</span></div>
              <strong>{metrics?.totalPurchases ? '$' + metrics.totalPurchases.toLocaleString() : '$0'}</strong>
              <small>Órdenes y adquisiciones</small>
            </article>
            <article className="card metric-card">
              <div className="metric-top"><span>Valor de stock</span><span className="metric-icon">▦</span></div>
              <strong>{metrics?.stockValue ? '$' + metrics.stockValue.toLocaleString() : '$0'}</strong>
              <small>Inventario valorizado</small>
            </article>
            <article className="card metric-card">
              <div className="metric-top"><span>Ingresos</span><span className="metric-icon">◎</span></div>
              <strong>{metrics?.monthlyRevenue ? '$' + metrics.monthlyRevenue.toLocaleString() : '$0'}</strong>
              <small>Periodo actual</small>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="card chart-card">
              <div className="section-heading">
                <div><h3>Actividad mensual</h3><span>Comportamiento de operaciones</span></div>
                <Link to="/reports">Detalle →</Link>
              </div>
              <div className="chart-list dashboard-chart">
                {chart.length === 0 ? <div className="empty-state">No hay datos para mostrar.</div> : chart.map((item) => (
                  <div key={item.label} className="chart-row">
                    <span>{item.label}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: Math.max((Number(item.value) || 0) / maxChartValue * 100, 4) + '%' }} />
                    </div>
                    <strong>{Number(item.value || 0).toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </article>

            <aside className="card quick-panel">
              <div className="section-heading">
                <div><h3>Resumen operativo</h3><span>Indicadores clave</span></div>
              </div>
              <div className="operation-list">
                <div><span>Clientes activos</span><strong>{metrics?.activeCustomers ?? 0}</strong></div>
                <div><span>Proveedores activos</span><strong>{metrics?.activeSuppliers ?? 0}</strong></div>
                <div><span>Pagos pendientes</span><strong>{metrics?.pendingPayments ? '$' + metrics.pendingPayments.toLocaleString() : '$0'}</strong></div>
                <div><span>Órdenes pendientes</span><strong>{metrics?.pendingOrders ?? 0}</strong></div>
              </div>
              <Link to="/inventory" className="panel-action">Revisar inventario →</Link>
            </aside>
          </section>

          <section className="card workflow-card">
            <div className="section-heading">
              <div><h3>Accesos rápidos</h3><span>Procesos principales del ERP</span></div>
            </div>
            <div className="quick-actions">
              <Link to="/sales"><span>↗</span><strong>Ventas</strong><small>Pedidos y operaciones</small></Link>
              <Link to="/purchases"><span>↙</span><strong>Compras</strong><small>Órdenes y recepción</small></Link>
              <Link to="/inventory"><span>▦</span><strong>Inventario</strong><small>Existencias y movimientos</small></Link>
              <Link to="/finance"><span>$</span><strong>Finanzas</strong><small>Cuentas y movimientos</small></Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
