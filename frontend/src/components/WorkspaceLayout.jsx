import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { NOTIFICATIONS_CHANGED_EVENT } from '../services/notifications';
import { hasAnyPermission, hasPermission } from '../services/permissions';

const sections = [
  {
    label: 'General',
    items: [{ to: '/', label: 'Resumen', icon: '⌂', permissions: ['dashboard.read'] }]
  },
  {
    label: 'Operación',
    items: [
      { to: '/inventory', label: 'Inventario', icon: '▤', permissions: ['inventory.read'] },
      { to: '/sales', label: 'Ventas', icon: '↗', permissions: ['sales.read'] },
      { to: '/purchases', label: 'Compras', icon: '⇣', permissions: ['purchases.read'] },
      { to: '/finance', label: 'Finanzas', icon: '◉', permissions: ['finance.read'] }
    ]
  },
  {
    label: 'Análisis',
    items: [{ to: '/reports', label: 'Reportes', icon: '▥', permissions: ['reports.read'] }]
  },
  {
    label: 'Catálogos',
    items: [
      { to: '/products', label: 'Productos', icon: '▦', permissions: ['products.read'] },
      { to: '/clients', label: 'Clientes y proveedores', icon: '♧', permissions: ['clients.read', 'suppliers.read'] },
      { to: '/categories', label: 'Categorías', icon: '▧', permissions: ['categories.read'] },
      { to: '/warehouses', label: 'Almacenes', icon: '▤', permissions: ['warehouses.read'] }
    ]
  },
  {
    label: 'Administración',
    items: [
      { to: '/users', label: 'Usuarios', icon: '♙', permissions: ['users.read'] },
      { to: '/roles', label: 'Roles y permisos', icon: '⌘', permissions: ['roles.read'] },
      { to: '/audit', label: 'Auditoría', icon: '◷', permissions: ['audit.read'] },
      { to: '/notifications', label: 'Notificaciones', icon: '♧', permissions: ['notifications.read'] },
      { to: '/integrations', label: 'Integraciones', icon: '⤢', demo: true, permissions: ['integrations.read'] },
      { to: '/settings', label: 'Configuración', icon: '⚙', demo: true, permissions: ['settings.read'] }
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
  '/warehouses': 'Almacenes',
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
  '/warehouses': 'Catálogo persistente de almacenes; las existencias se consultan en Inventario.',
  '/users': 'Administración persistente de cuentas de usuario.',
  '/roles': 'Administración persistente de roles y permisos.',
  '/audit': 'Eventos persistentes registrados por el núcleo.',
  '/reports': 'Reportes operativos consultados de ventas, compras, inventario y finanzas.',
  '/notifications': 'Notificaciones internas vinculadas a tus permisos y operaciones del ERP.',
  '/integrations': 'Panel demostrativo de integraciones.',
  '/settings': 'Preferencias de muestra, aún no persistidas.'
};

const demoPaths = new Set(['/integrations', '/settings']);

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U';
}

export default function WorkspaceLayout({ session, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { pathname } = useLocation();
  const pageTitle = pageTitles[pathname] || 'Espacio de trabajo';
  const isDemo = demoPaths.has(pathname);
  const visibleSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => hasAnyPermission(session?.user, item.permissions))
  })).filter(section => section.items.length);

  useEffect(() => {
    if (!hasPermission(session?.user, 'notifications.read') || !session?.token) { setUnreadCount(0); return undefined; }
    let active = true;
    const refreshCount = async () => {
      try {
        const result = await apiRequest('/api/notifications/unread-count');
        if (active) setUnreadCount(Number(result.data?.count) || 0);
      } catch { if (active) setUnreadCount(0); }
    };
    refreshCount();
    window.addEventListener('focus', refreshCount);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshCount);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshCount);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshCount);
    };
  }, [pathname, session?.token, session?.user]);

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
          {visibleSections.map(section => (
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
            {hasPermission(session?.user, 'notifications.read') ? <NavLink to="/notifications" className="topbar-icon-link notification-bell" aria-label={`Notificaciones, ${unreadCount} sin leer`}><span aria-hidden="true">♧</span>{unreadCount > 0 ? <span className="notification-count-badge">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}</NavLink> : null}
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
            <span><strong>Vista demostrativa.</strong> Los datos de esta área no representan registros empresariales persistidos.</span>
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
