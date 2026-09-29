import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL, apiFetch } from '../../services/api';

const shortcuts = [
  { to: '/products', icon: '▦', label: 'Productos y catálogos' },
  { to: '/users', icon: '♙', label: 'Usuarios y accesos' },
  { to: '/audit', icon: '◷', label: 'Registro de auditoría' },
  { to: '/inventory', icon: '▤', label: 'Inventario', demo: true }
];

function AreaChart({ chart }) {
  const values = chart.map(item => Number(item.value) || 0);
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = 28 + (index * 620) / Math.max(values.length - 1, 1);
    const y = 172 - (value / max) * 135;
    return `${x},${y}`;
  });
  const line = points.join(' ');
  const area = values.length ? `28,172 ${line} ${28 + ((values.length - 1) * 620) / Math.max(values.length - 1, 1)},172` : '';

  return (
    <svg className="area-chart" viewBox="0 0 680 205" role="img" aria-label="Gráfica de muestra de ingresos">
      {[37, 82, 127, 172].map(y => <line key={y} className="gridline" x1="28" y1={y} x2="650" y2={y} />)}
      {values.length ? <>
        <polygon className="area-fill" points={area} />
        <polyline className="area-line" points={line} />
        {chart.map((item, index) => <text key={`${item.label}-${index}`} x={28 + (index * 620) / Math.max(values.length - 1, 1)} y="195" textAnchor="middle">{item.label}</text>)}
      </> : <text x="340" y="108" textAnchor="middle">Sin datos disponibles</text>}
    </svg>
  );
}

export default function DashboardPage({ session }) {
  const [metrics, setMetrics] = useState(null);
  const [chart, setChart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      try {
        if (!session?.token) throw new Error('Sesión no disponible.');
        const response = await apiFetch(`${API_URL}/api/dashboard`, {
          headers: { Authorization: `Bearer ${session.token}` }
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error(payload?.message || 'No se pudo cargar el dashboard');
        if (active) {
          setMetrics(payload.data?.metrics || null);
          setChart(payload.data?.chart || []);
        }
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDashboard();
    return () => { active = false; };
  }, [session?.token]);

  const money = value => `$${(Number(value) || 0).toLocaleString()}`;

  return (
    <div className="app-shell dashboard-layout dashboard-page">
      <div className="dashboard-section-heading dashboard-welcome">
        <div><span className="eyebrow">Panel de control</span><h2>Dashboard ERP</h2><p>Hola, {session?.user?.name || 'usuario'}. Resumen del espacio de trabajo.</p></div>
        <span className="demo-pill">Vista demostrativa</span>
      </div>

      <div className="prototype-banner" role="note">
        <span aria-hidden="true">ⓘ</span>
        <div><strong>Los indicadores todavía son datos de muestra.</strong> Ventas, compras, inventario y finanzas no están conectados a persistencia MongoDB.</div>
      </div>

      {error ? <div className="card warning-box" role="alert">No se pudieron actualizar los datos de muestra: {error}</div> : null}

      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <section className="stats-grid" aria-label="Indicadores demostrativos">
            {[
              ['Ventas', money(metrics?.totalSales), '↗', 'mint'],
              ['Compras', money(metrics?.totalPurchases), '⇣', 'blue'],
              ['Valor de inventario', money(metrics?.stockValue), '▤', 'coral'],
              ['Ingresos del mes', money(metrics?.monthlyRevenue), '＋', 'mint']
            ].map(([label, value, icon, tone]) => <article className={`card stat-card stat-${tone}`} key={label}>
              <span className="stat-icon" aria-hidden="true">{icon}</span><span>{label}</span>
              <strong>{loading ? '—' : value}</strong><small>Dato de muestra</small>
            </article>)}
          </section>

          <section className="card">
            <div className="dashboard-section-heading"><div><h2>Flujo de operaciones</h2><p>Etapas ilustrativas; no reflejan transacciones persistidas.</p></div><span className="demo-pill">Demo</span></div>
            <div className="pipeline-grid">
              {[
                ['Clientes activos', metrics?.activeCustomers],
                ['Proveedores activos', metrics?.activeSuppliers],
                ['Pagos pendientes', metrics?.pendingPayments, true],
                ['Órdenes pendientes', metrics?.pendingOrders]
              ].map(([label, value, isMoney]) => <div className="pipeline-step" key={label}><small>{label}</small><strong>{loading ? '—' : isMoney ? money(value) : Number(value) || 0}</strong><em>Indicador de muestra</em></div>)}
            </div>
          </section>

          <section className="card chart-card">
            <div className="dashboard-section-heading"><div><h2>Tendencia de ingresos</h2><p>Serie ficticia del prototipo, pendiente de conexión a reportes reales.</p></div><span className="demo-pill">Datos demo</span></div>
            <AreaChart chart={chart} />
          </section>
        </div>

        <aside className="dashboard-rail">
          <section className="card rail-card">
            <div className="rail-heading"><h2>Accesos rápidos</h2></div>
            <div className="quick-link-list">{shortcuts.map(item => <Link className="quick-link" to={item.to} key={item.to}>
              <span className="quick-link-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>{item.demo ? <span className="demo-pill">Demo</span> : <b aria-hidden="true">›</b>}
            </Link>)}</div>
          </section>
          <section className="card rail-card">
            <div className="rail-heading"><h2>Estado del núcleo</h2></div>
            <div className="status-list">
              <div className="status-row"><span>Usuarios y roles</span><span className="status-dot">MongoDB</span></div>
              <div className="status-row"><span>Catálogos base</span><span className="status-dot">MongoDB</span></div>
              <div className="status-row"><span>Auditoría del núcleo</span><span className="status-dot">MongoDB</span></div>
              <div className="status-row"><span>Operación ERP</span><span className="status-dot demo">Prototipo</span></div>
            </div>
            <p className="rail-note">La verificación de integración con MongoDB requiere configurar `TEST_MONGODB_URI` en el entorno de pruebas.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
