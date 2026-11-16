/**
 * Resolves and normalizes the backend API base URL for both local development and production.
 *
 * Scenarios handled:
 * 1. Default (local dev): '' -> returns '/api' (proxied via Vite dev server to backend)
 * 2. Remote Render backend without /api: 'https://noah-gaming.onrender.com' -> 'https://noah-gaming.onrender.com/api'
 * 3. Remote Render backend with /api: 'https://noah-gaming.onrender.com/api' -> 'https://noah-gaming.onrender.com/api'
 * 4. Trailing slashes are stripped.
 * 5. Production guard: If VITE_API_URL is missing in production, warns clearly.
 */
function resolveApiBaseUrl() {
  const envUrl = (
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    ''
  ).trim();

  if (!envUrl) {
    if (
      import.meta.env.PROD &&
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      console.warn(
        '[NOAH GAMING] VITE_API_URL is not set in production. Please set VITE_API_URL=https://noah-gaming.onrender.com in your deployment dashboard.'
      );
    }
    return '/api';
  }

  // Strip trailing slashes
  const cleanUrl = envUrl.replace(/\/+$/, '');

  // Relative path (e.g. '/api')
  if (cleanUrl.startsWith('/')) {
    return cleanUrl;
  }

  // Remote URL already ending with /api
  if (cleanUrl.endsWith('/api')) {
    return cleanUrl;
  }

  // Remote URL without /api: append /api to match Express routes
  return `${cleanUrl}/api`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export function getAuthToken() {
  return localStorage.getItem('noah_auth_token') || localStorage.getItem('nexus_auth_token');
}

/**
 * Universal API Request Handler
 * Centralizes request execution, auth token injection, error handling, and URL normalization.
 */
export async function apiRequest(endpoint, { method = 'GET', body = null, headers = {} } = {}) {
  // Guard against missing production API URL on remote hosting (prevents hitting Vercel's domain for /api routes)
  if (
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    (!API_BASE_URL || API_BASE_URL === '/api')
  ) {
    throw new Error(
      'Production API URL is not configured. Please define VITE_API_URL (e.g. https://noah-gaming.onrender.com) in your Vercel project environment variables and redeploy.'
    );
  }

  const token = getAuthToken();

  // Normalize endpoint with leading slash
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Prevent duplicate '/api' if both API_BASE_URL and endpoint start with it
  if (API_BASE_URL.endsWith('/api') && cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.substring(4);
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const config = {
    method,
    headers: defaultHeaders,
    ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  };

  try {
    const url = `${API_BASE_URL}${cleanEndpoint}`;
    const res = await fetch(url, config);

    // Safely parse JSON or text response
    const contentType = res.headers.get('content-type') || '';
    let data = null;
    const isJson = contentType.includes('application/json');

    if (isJson) {
      data = await res.json().catch(() => null);
    } else {
      const rawText = await res.text().catch(() => '');
      const isHtml = /<html|<!doctype/i.test(rawText);
      const cleanMsg = isHtml
        ? `Server returned HTTP ${res.status} (${res.statusText || 'HTML Error'}). Verify backend status at ${API_BASE_URL}.`
        : (rawText.trim() || `HTTP ${res.status}`);
      data = { message: cleanMsg };
    }

    if (!res.ok) {
      const errorMsg =
        data?.message ||
        data?.errors?.[0]?.message ||
        `Request failed with status ${res.status}`;
      const error = new Error(errorMsg);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
      const networkErr = new Error(
        `Unable to reach backend at ${API_BASE_URL || 'server'}. Please ensure Render is awake and CORS_ORIGIN includes this domain.`
      );
      networkErr.originalError = err;
      networkErr.status = 0;
      throw networkErr;
    }
    throw err;
  }
}
