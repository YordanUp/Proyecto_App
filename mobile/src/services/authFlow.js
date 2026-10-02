async function login(email, password, { request, store }) {
  const payload = await request('/api/auth/login', { method: 'POST', body: { email, password } });
  const token = payload?.data?.token;
  const user = payload?.data?.user;
  if (!token || !user) throw new Error('El backend no devolvió una sesión válida.');
  await store.saveToken(token);
  return { token, user };
}

async function restoreSession({ request, store }) {
  let token;
  try {
    token = await store.getToken();
  } catch {
    return { status: 'signedOut', token: null, user: null };
  }
  if (!token) return { status: 'signedOut', token: null, user: null };

  try {
    const payload = await request('/api/auth/me', { token });
    if (!payload?.data?.id) throw new Error('El backend no devolvió el perfil de sesión.');
    return { status: 'signedIn', token, user: payload.data };
  } catch (error) {
    if (error?.status === 401 || error?.status === 404) {
      await store.clearToken();
      return { status: 'signedOut', token: null, user: null };
    }
    return { status: 'offline', token, user: null, error };
  }
}

async function logout({ request, store, token }) {
  try {
    if (token) await request('/api/auth/logout', { method: 'POST', token });
  } finally {
    await store.clearToken();
  }
}

module.exports = { login, restoreSession, logout };
