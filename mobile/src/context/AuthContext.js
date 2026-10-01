import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api/client';
import { sessionStore } from '../storage/sessionStore';
import { login as loginFlow, logout as logoutFlow, restoreSession } from '../services/authFlow';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ status: 'checking', token: null, user: null, error: null });
  const [signingIn, setSigningIn] = useState(false);

  const runRestore = useCallback(async () => {
    setSession(current => ({ ...current, status: 'checking', error: null }));
    try {
      const restored = await restoreSession({ request: apiRequest, store: sessionStore });
      setSession({ ...restored, error: restored.error || null });
      return restored;
    } catch (error) {
      const offline = { status: 'offline', token: null, user: null, error };
      setSession(offline);
      return offline;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(runRestore, 0);
    return () => clearTimeout(timer);
  }, [runRestore]);

  const signIn = useCallback(async (email, password) => {
    setSigningIn(true);
    try {
      const result = await loginFlow(email, password, { request: apiRequest, store: sessionStore });
      setSession({ status: 'signedIn', ...result, error: null });
      return result;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async ({ notifyBackend = true } = {}) => {
    const token = session.token;
    try {
      if (notifyBackend) await logoutFlow({ request: apiRequest, store: sessionStore, token });
      else await sessionStore.clearToken();
    } catch {
      // Keep local logout available when the backend cannot be reached.
    } finally {
      setSession({ status: 'signedOut', token: null, user: null, error: null });
    }
  }, [session.token]);

  const request = useCallback((path, options = {}) => apiRequest(path, {
    ...options,
    token: options.token || session.token || undefined,
    onUnauthorized: () => signOut({ notifyBackend: false })
  }), [session.token, signOut]);

  const value = useMemo(() => ({
    ...session,
    signingIn,
    signIn,
    signOut,
    retrySession: runRestore,
    request
  }), [session, signingIn, signIn, signOut, runRestore, request]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
