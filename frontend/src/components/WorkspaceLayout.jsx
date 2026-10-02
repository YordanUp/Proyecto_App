import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const sections = [
  {
    label: 'General',
    items: [{ to: '/', label: 'Resumen', icon: '⌂' }]
  },
  {
    label: 'Operación',
    items: [
      { to: '/inventory', label: 'Inventario', icon: '▤' },
      { to: '/sales', label: 'Ventas', icon: '↗' },
      { to: '/purchases', label: 'Compras', icon: '⇣' },
      { to: '/finance', label: 'Finanzas', icon: '◉' }
    ]
  },
  {
    label: 'Catálogos',
    items: [
      { to: '/products', label: 'Productos', icon: '▦' },
      { to: '/clients', label: 'Clientes y proveedores', icon: '♧' },
      { to: '/categories', label: 'Categorías', icon: '▧' }
    ]
  },
  {
    label: 'Administración',
    items: [
      { to: '/users', label: 'Usuarios', icon: '♙' },
      { to: '/roles', label: 'Roles y permisos', icon: '⌘' },
      { to: '/audit', label: 'Auditoría', icon: '◷' },
      { to: '/reports', label: 'Reportes', icon: '▥', demo: true },
      { to: '/notifications', label: 'Notificaciones', icon: '♧', demo: true },
      { to: '/integrations', label: 'Integraciones', icon: '⤢', demo: true },
      { to: '/settings', label: 'Configuración', icon: '⚙', demo: true }
    ]
  }
];

const pageTitles = sections.flatMap(section => section.items).reduce((titles, item) => {
  titles[item.to] = item.label;
  return titles;
}, {});
Object.assign(pageTitles, {
  '/inventory': 'Stock y almacenes',
  '/sales': 'Ventas',
  '/purchases': 'Órdenes y compras',
  '/finance': 'Cuentas y pagos',
  '/products': 'Productos',
  '/clients': 'Clientes y proveedores',
  '/categories': 'Categorías',
  '/users': 'Usuarios y permisos',
  '/roles': 'Roles y permisos',
  '/audit': 'Auditoría del sistema',
  '/reports': 'Reportes y auditoría',
  '/notifications': 'Notificaciones del sistema',
  '/integrations': 'Integraciones del sistema',
  '/settings': 'Configuración del sistema'
});

const pageDescriptions = {
  '/inventory': 'Existencias y movimientos persistidos por almacén.',
  '/sales': 'Ventas persistentes con confirmación y movimientos de inventario transaccionales.',
  '/purchases': 'Compras persistentes con recepción e impacto transaccional en inventario.',
  '/finance': 'Cuentas por cobrar, cuentas por pagar y movimientos financieros persistentes.',
  '/products': 'Catálogo persistente de productos.',
  '/clients': 'Catálogos persistentes de clientes y proveedores.',
  '/categories': 'Catálogo persistente de categorías.',
  '/users': 'Administración persistente de cuentas de usuario.',
  '/roles': 'Administración persistente de roles y permisos.',
  '/audit': 'Eventos persistentes registrados por el núcleo.',
  '/reports': 'Reportes de muestra; la bitácora del núcleo se consulta por separado.',
  '/notifications': 'Bandeja demostrativa de notificaciones.',
  '/integrations': 'Panel demostrativo de integraciones.',
  '/settings': 'Preferencias de muestra, aún no persistidas.'
};

const demoPaths = new Set(['/reports', '/notifications', '/integrations', '/settings']);

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U';
}

export default function WorkspaceLayout({ session, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const pageTitle = pageTitles[pathname] || 'Espacio de trabajo';
  const isDemo = demoPaths.has(pathname);

  return (
    <div className={`erp-layout${sidebarOpen ? ' sidebar-open' : ''}`}>
      <aside className="erp-sidebar" aria-label="Navegación principal">
        <NavLink to="/" className="brand-lockup" onClick={() => setSidebarOpen(false)}>
          <span className="brand-logo-tile">
            <img src="/brand/logo-yordanup.png" alt="Logo YordanUp" />
          </span>
          <span className="brand-copy">
            <strong>YordanUp</strong>
            <small>ERP modular</small>
          </span>
        </NavLink>

        <div className="sidebar-caption">Espacio de trabajo</div>
        <nav className="sidebar-navigation">
          {sections.map(section => (
            <div className="nav-section" key={section.label}>
              <span className="nav-section-title">{section.label}</span>
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {item.demo ? <span className="nav-demo">Demo</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <span className="user-avatar">{initials(session?.user?.name)}</span>
            <span className="sidebar-user-copy">
              <strong>{session?.user?.name || 'Usuario'}</strong>
              <small>{session?.user?.role || 'Cuenta ERP'}</small>
            </span>
          </div>
          <button type="button" className="sidebar-logout" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </aside>

      {sidebarOpen ? <button className="sidebar-backdrop" type="button" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)} /> : null}

      <div className="erp-workspace">
        <header className="erp-topbar">
          <button type="button" className="menu-toggle" aria-label="Abrir menú" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="topbar-heading" aria-hidden="true">
            <span className="topbar-kicker">YordanUp / ERP</span>
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-actions">
            <NavLink to="/notifications" className="topbar-icon-link" aria-label="Notificaciones">♧</NavLink>
            <div className="topbar-user">
              <span className="user-avatar topbar-avatar">{initials(session?.user?.name)}</span>
              <span className="topbar-user-copy">
                <strong>{session?.user?.name || 'Usuario'}</strong>
                <small>{session?.user?.role || 'Cuenta ERP'}</small>
              </span>
            </div>
          </div>
        </header>

        <main className="erp-content">
          {pathname !== '/' ? <div className="workspace-page-intro">
            <div>
              <span className="eyebrow">{isDemo ? 'Área demostrativa' : 'Núcleo persistente'}</span>
              <h2>{pageTitle}</h2>
              <p>{pageDescriptions[pathname] || 'Módulo del espacio de trabajo YordanUp.'}</p>
            </div>
            <span className={`workspace-state${isDemo ? ' demo' : ''}`}>{isDemo ? 'Datos de muestra' : 'Persistente'}</span>
          </div> : null}
          {isDemo && pathname !== '/' ? <div className="module-demo-notice" role="note">
            <span aria-hidden="true">ⓘ</span>
            <span><strong>Vista demostrativa.</strong> {pathname === '/reports'
              ? 'Los reportes y notificaciones son datos de muestra; la bitácora del núcleo sí contiene eventos persistidos.'
              : 'Los datos de esta área no representan registros empresariales persistidos.'}</span>
          </div> : null}
          <Outlet />
        </main>
        <footer className="erp-footer">
          <span>YordanUp ERP</span>
          <span>Áreas marcadas como Demo utilizan datos de muestra.</span>
        </footer>
      </div>
    </div>
  );
}
