import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function DashboardPage({ session, onLogout }) {
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

        const response = await fetch(`${API_URL}/api/dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
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

  return (
    <div className="app-shell dashboard-layout">
      <header className="topbar card">
        <div>
          <span className="eyebrow">Bienvenido</span>
          <h1>Dashboard ERP</h1>
        </div>

        <div className="user-area">
          <span>{session?.user?.name || 'Usuario'}</span>
          <Link to="/products" className="link-button">Productos</Link>
          <Link to="/inventory" className="link-button">Inventario</Link>
          <Link to="/sales" className="link-button">Ventas</Link>
          <Link to="/purchases" className="link-button">Compras</Link>
          <Link to="/finance" className="link-button">Finanzas</Link>
          <Link to="/reports" className="link-button">Reportes</Link>
          <Link to="/notifications" className="link-button">Notificaciones</Link>
          <Link to="/integrations" className="link-button">Integraciones</Link>
          <Link to="/audit" className="link-button">Auditoría</Link>
          <Link to="/clients" className="link-button">Clientes</Link>
          <Link to="/categories" className="link-button">Categorías</Link>
          <Link to="/users" className="link-button">Usuarios</Link>
          <Link to="/roles" className="link-button">Roles</Link>
          <Link to="/settings" className="link-button">Configuración</Link>
          <button type="button" className="secondary" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      {error ? <div className="card warning-box">{error}</div> : null}

      {loading ? (
        <div className="card">Cargando métricas...</div>
      ) : (
        <>
          <section className="stats-grid">
            <div className="card stat-card">
              <span>Ventas</span>
              <strong>{metrics?.totalSales ? `$${metrics.totalSales.toLocaleString()}` : '$0'}</strong>
            </div>
            <div className="card stat-card">
              <span>Compras</span>
              <strong>{metrics?.totalPurchases ? `$${metrics.totalPurchases.toLocaleString()}` : '$0'}</strong>
            </div>
            <div className="card stat-card">
              <span>Stock</span>
              <strong>{metrics?.stockValue ? `$${metrics.stockValue.toLocaleString()}` : '$0'}</strong>
            </div>
            <div className="card stat-card">
              <span>Ingresos</span>
              <strong>{metrics?.monthlyRevenue ? `$${metrics.monthlyRevenue.toLocaleString()}` : '$0'}</strong>
            </div>
          </section>

          <section className="content-grid">
            <div className="card">
              <h3>Resumen mensual</h3>
              <div className="chart-list">
                {chart.map((item) => (
                  <div key={item.label} className="chart-row">
                    <span>{item.label}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(item.value / 9000) * 100}%` }} />
                    </div>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3>Operaciones</h3>
              <ul className="summary-list">
                <li>Clientes activos: {metrics?.activeCustomers ?? 0}</li>
                <li>Proveedores activos: {metrics?.activeSuppliers ?? 0}</li>
                <li>Pagos pendientes: ${metrics?.pendingPayments?.toLocaleString() ?? '0'}</li>
                <li>Órdenes pendientes: {metrics?.pendingOrders ?? 0}</li>
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
