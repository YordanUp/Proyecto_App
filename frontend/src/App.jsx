import { useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { apiRequest } from './services/api';
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

const STORAGE_KEY = 'erp_token';
const STORAGE_USER = 'erp_user';

function readSession() {
  const token = localStorage.getItem(STORAGE_KEY);
  const rawUser = localStorage.getItem(STORAGE_USER);

  if (!token) {
    return { token: null, user: null };
  }

  return {
    token,
    user: rawUser ? JSON.parse(rawUser) : null
  };
}

function ProtectedRoute({ isAuthenticated, children }) {
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

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
      const nextSession = { token, user };

      localStorage.setItem(STORAGE_KEY, token);
      localStorage.setItem(STORAGE_USER, JSON.stringify(user));
      setSession(nextSession);

      return { success: true, message: payload.message };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'No se pudo conectar con el backend.'
      };
    }
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_USER);
    setSession({ token: null, user: null });
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <DashboardPage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <ProductsPage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <InventoryPage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <SalesPage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchases"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <PurchasesPage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <FinancePage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <ReportsPage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <NotificationsPage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <IntegrationsPage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <AuditPage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <UsersPage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <RolesPage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <SettingsPage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <CatalogPage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/categories"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <CategoriesPage session={authContext} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage onLogin={handleLogin} />
          )
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
