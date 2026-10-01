const config = require('../constants/config');

class ApiError extends Error {
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
  return `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

/** @param {any} options */
async function apiRequest(path, options = {}) {
  const { token, method = 'GET', body, headers: suppliedHeaders, timeoutMs = config.requestTimeoutMs, onUnauthorized } = options;
  const headers = { Accept: 'application/json', ...(suppliedHeaders || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let requestBody = body;
  if (body !== undefined && body !== null && typeof body !== 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    requestBody = JSON.stringify(body);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response;
  try {
    response = await fetch(resolveUrl(path), { method, headers, body: requestBody, signal: controller.signal });
  } catch {
    if (timedOut) throw new ApiError('El servidor está tardando en responder. Puede estar despertando; inténtalo de nuevo.', { code: 'REQUEST_TIMEOUT' });
    throw new ApiError('No se pudo conectar con el backend. Revisa la conexión e inténtalo de nuevo.');
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    throw new ApiError('El backend devolvió una respuesta no válida.', { status: response.status, code: 'INVALID_RESPONSE' });
  }
  if (!response.ok || payload.success === false) {
    const error = new ApiError(payload.message || 'La solicitud no pudo completarse.', {
      status: response.status,
      code: payload.error || 'REQUEST_FAILED',
      details: payload.details || null
    });
    if (response.status === 401 && typeof onUnauthorized === 'function') await onUnauthorized();
    throw error;
  }
  return payload;
}

function userMessage(error) {
  if (error?.status === 401) return 'La sesión venció. Inicia sesión otra vez.';
  if (error?.status === 403) return 'Tu cuenta no tiene permiso para esta acción.';
  if (error?.status === 404) return 'No se encontró la información solicitada.';
  if (error?.status >= 500) return 'El servidor no pudo completar la solicitud. Inténtalo más tarde.';
  if (error?.code === 'REQUEST_TIMEOUT') return 'El servidor está tardando en responder; Render puede estar despertando. Vuelve a intentarlo.';
  return error?.message || 'Ocurrió un error. Inténtalo de nuevo.';
}

module.exports = { ApiError, apiRequest, userMessage, resolveUrl };
