import { useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  AuditPage, CategoriesPage, CatalogPage, DashboardPage, FinancePage,
  IntegrationsPage, InventoryPage, LoginPage, NotFoundPage, NotificationsPage,
  ProductsPage, PurchasesPage, ReportsPage, RolesPage, SalesPage, SettingsPage, UsersPage
} from './screens';

const STORAGE_KEY = 'erp_token';
const STORAGE_USER = 'erp_user';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function readSession() {
  const token = localStorage.getItem(STORAGE_KEY);
  const rawUser = localStorage.getItem(STORAGE_USER);
  if (!token) return { token: null, user: null };
  try {
    return { token, user: rawUser ? JSON.parse(rawUser) : null };
  } catch {
    localStorage.removeItem(STORAGE_USER);
    return { token, user: null };
  }
}

function ProtectedRoute({ isAuthenticated, children, session, onLogout }) {
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <AppLayout session={session} onLogout={onLogout}>{children}</AppLayout>;
}

const navigation = [
  { title: 'Principal', items: [
    { to: '/', label: 'Dashboard', icon: '⌂', end: true },
    { to: '/notifications', label: 'Notificaciones', icon: '◉' }
  ]},
  { title: 'Operación', items: [
    { to: '/products', label: 'Productos', icon: '□' },
    { to: '/inventory', label: 'Inventario', icon: '▦' },
    { to: '/sales', label: 'Ventas', icon: '↗' },
    { to: '/purchases', label: 'Compras', icon: '↙' },
    { to: '/finance', label: 'Finanzas', icon: '$' }
  ]},
  { title: 'Catálogos', items: [
    { to: '/clients', label: 'Clientes', icon: '◌' },
    { to: '/categories', label: 'Categorías', icon: '◇' }
  ]},
  { title: 'Control', items: [
    { to: '/reports', label: 'Reportes', icon: '▥' },
    { to: '/users', label: 'Usuarios', icon: '◎' },
    { to: '/roles', label: 'Roles', icon: '◆' },
    { to: '/audit', label: 'Auditoría', icon: '✓' },
    { to: '/integrations', label: 'Integraciones', icon: '↔' },
    { to: '/settings', label: 'Configuración', icon: '⚙' }
  ]}
];

function AppLayout({ session, onLogout, children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={'erp-layout ' + (collapsed ? 'sidebar-collapsed' : '')}>
      <aside className="erp-sidebar">
        <div className="brand">
          <img src="/assets/upti-erp-logo.webp" alt="Logo del ERP" className="brand-logo" />
          <div className="brand-copy"><strong>ERP</strong><span>Management System</span></div>
          <button type="button" className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Navegación principal">
          {navigation.map((group) => (
            <div className="nav-group" key={group.title}>
              <span className="nav-group-title">{group.title}</span>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end}
                  className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}
                  title={collapsed ? item.label : undefined}>
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="help-button" onClick={() => window.alert('Centro de ayuda del ERP')}>
            <span>?</span><span className="nav-label">Ayuda</span>
          </button>
        </div>
      </aside>

      <main className="erp-main">
        <div className="erp-mainbar">
          <div>
            <span className="mainbar-title">ERP Modular</span>
            <span className="mainbar-status"><i /> Sistema operativo</span>
          </div>
          <div className="mainbar-user">
            <div className="user-avatar">{(session?.user?.name || 'U').charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <strong>{session?.user?.name || 'Usuario'}</strong>
              <span>{session?.user?.role || 'Usuario'}</span>
            </div>
            <button type="button" className="user-logout" onClick={onLogout} title="Cerrar sesión">↪</button>
          </div>
        </div>
        <div className="erp-content">{children}</div>
      </main>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(readSession);
  const isAuthenticated = Boolean(session.token);
  const authContext = useMemo(() => ({
    token: session.token, user: session.user, isAuthenticated
  }), [session, isAuthenticated]);

  async function handleLogin(credentials) {
    try {
      const response = await fetch(API_URL + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        return { success: false, message: payload?.message || 'Credenciales inválidas' };
      }
      const { token, user } = payload.data;
      const nextSession = { token, user };
      localStorage.setItem(STORAGE_KEY, token);
      localStorage.setItem(STORAGE_USER, JSON.stringify(user));
      setSession(nextSession);
      return { success: true, message: payload.message };
    } catch {
      return { success: false, message: 'No se pudo conectar con el backend.' };
    }
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_USER);
    setSession({ token: null, user: null });
  }

  const protectedProps = { isAuthenticated, session: authContext, onLogout: handleLogout };

  return (
    <Routes>
      <Route path="/" element={<ProtectedRoute {...protectedProps}><DashboardPage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute {...protectedProps}><ProductsPage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute {...protectedProps}><InventoryPage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute {...protectedProps}><SalesPage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/purchases" element={<ProtectedRoute {...protectedProps}><PurchasesPage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute {...protectedProps}><FinancePage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute {...protectedProps}><ReportsPage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute {...protectedProps}><NotificationsPage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/integrations" element={<ProtectedRoute {...protectedProps}><IntegrationsPage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute {...protectedProps}><AuditPage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute {...protectedProps}><UsersPage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/roles" element={<ProtectedRoute {...protectedProps}><RolesPage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute {...protectedProps}><SettingsPage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute {...protectedProps}><CatalogPage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/categories" element={<ProtectedRoute {...protectedProps}><CategoriesPage session={authContext} onLogout={handleLogout} /></ProtectedRoute>} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
