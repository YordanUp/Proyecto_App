export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function resolveUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem('erp_token');
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let response;
  try {
    response = await fetch(resolveUrl(path), { ...options, headers });
  } catch {
    throw new ApiError('No se pudo conectar con el backend.');
  }
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    throw new ApiError('El backend devolvió una respuesta no válida.', { status: response.status, code: 'INVALID_RESPONSE' });
  }
  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.message || 'La solicitud no pudo completarse.', {
      status: response.status,
      code: payload?.error || 'REQUEST_FAILED',
      details: payload?.details || null
    });
  }
  return payload;
}

// Transitional response shape keeps existing screens working during the API migration.
export async function apiFetch(path, options = {}) {
  const payload = await apiRequest(path, options);
  return { ok: true, status: 200, json: async () => payload };
}
