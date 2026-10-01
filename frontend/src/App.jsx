import { useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { apiRequest } from './services/api';
import WorkspaceLayout from './components/WorkspaceLayout';
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
  UsersPage
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

function ProtectedRoute({ isAuthenticated, children }) {
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
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
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <WorkspaceLayout session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        )}
      >
        <Route path="/" element={<DashboardPage session={authContext} />} />
        <Route path="/products" element={<ProductsPage session={authContext} />} />
        <Route path="/inventory" element={<InventoryPage session={authContext} />} />
        <Route path="/sales" element={<SalesPage session={authContext} />} />
        <Route path="/purchases" element={<PurchasesPage session={authContext} />} />
        <Route path="/finance" element={<FinancePage session={authContext} />} />
        <Route path="/reports" element={<ReportsPage session={authContext} />} />
        <Route path="/notifications" element={<NotificationsPage session={authContext} />} />
        <Route path="/integrations" element={<IntegrationsPage session={authContext} />} />
        <Route path="/audit" element={<AuditPage session={authContext} />} />
        <Route path="/users" element={<UsersPage session={authContext} />} />
        <Route path="/roles" element={<RolesPage session={authContext} />} />
        <Route path="/settings" element={<SettingsPage session={authContext} />} />
        <Route path="/clients" element={<CatalogPage session={authContext} />} />
        <Route path="/categories" element={<CategoriesPage session={authContext} />} />
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
