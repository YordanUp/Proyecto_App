import { useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { apiRequest } from './services/api';
import WorkspaceLayout from './components/WorkspaceLayout';
import { ROUTE_PERMISSIONS, hasAnyPermission } from './services/permissions';
import {
  AuditPage,
  CategoriesPage,
  CatalogPage,
  DashboardPage,
  FinancePage,
  IntegrationsPage,
  InventoryPage,
  LoginPage,
  NotFoundPage,
  NotificationsPage,
  ProductsPage,
  PurchasesPage,
  ReportsPage,
  RolesPage,
  SalesPage,
  SettingsPage,
  UsersPage,
  WarehousesPage
} from './screens';
import VerifyEmailPage from './screens/Login/VerifyEmailPage';

const STORAGE_KEY = 'erp_token';
const STORAGE_USER = 'erp_user';

function readSession() {
  try {
    const token = localStorage.getItem(STORAGE_KEY);
    const rawUser = localStorage.getItem(STORAGE_USER);
    if (!token) return { token: null, user: null };
    return { token, user: rawUser ? JSON.parse(rawUser) : null };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_USER);
    return { token: null, user: null };
  }
}

function ProtectedRoute({ isAuthenticated, user, permission, children }) {
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  if (permission && !hasAnyPermission(user, permission)) return <div className="card warning-box" role="alert">No tienes permiso para acceder a este módulo.</div>;
  return children;
}

export default function App() {
  const [session, setSession] = useState(readSession);
  const isAuthenticated = Boolean(session.token);
  const authContext = useMemo(() => ({
    token: session.token,
    user: session.user,
    isAuthenticated
  }), [session, isAuthenticated]);

  async function handleLogin(credentials) {
    try {
      const payload = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      const { token, user } = payload.data;
      localStorage.setItem(STORAGE_KEY, token);
      localStorage.setItem(STORAGE_USER, JSON.stringify(user));
      setSession({ token, user });
      return { success: true, message: payload.message };
    } catch (error) {
      return { success: false, code: error.code, message: error.message || 'No se pudo conectar con el backend.' };
    }
  }

  async function handleLogout() {
    try {
      if (session.token) await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // A local logout must still work when the API is unavailable.
    } finally {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_USER);
      setSession({ token: null, user: null });
    }
  }

  return (
    <Routes>
      <Route
        element={(
          <ProtectedRoute isAuthenticated={isAuthenticated} user={session.user}>
            <WorkspaceLayout session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        )}
      >
        <Route path="/" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/']}><DashboardPage session={authContext} /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/products']}><ProductsPage session={authContext} /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/inventory']}><InventoryPage session={authContext} /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/sales']}><SalesPage session={authContext} /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/purchases']}><PurchasesPage session={authContext} /></ProtectedRoute>} />
        <Route path="/finance" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/finance']}><FinancePage session={authContext} /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/reports']}><ReportsPage session={authContext} /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/notifications']}><NotificationsPage session={authContext} /></ProtectedRoute>} />
        <Route path="/integrations" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/integrations']}><IntegrationsPage session={authContext} /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/audit']}><AuditPage session={authContext} /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/users']}><UsersPage session={authContext} /></ProtectedRoute>} />
        <Route path="/roles" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/roles']}><RolesPage session={authContext} /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/settings']}><SettingsPage session={authContext} /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/clients']}><CatalogPage session={authContext} /></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/categories']}><CategoriesPage session={authContext} /></ProtectedRoute>} />
        <Route path="/warehouses" element={<ProtectedRoute isAuthenticated user={session.user} permission={ROUTE_PERMISSIONS['/warehouses']}><WarehousesPage session={authContext} /></ProtectedRoute>} />
      </Route>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />}
      />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
