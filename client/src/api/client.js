export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export function getAuthToken() {
  return localStorage.getItem('noah_auth_token') || localStorage.getItem('nexus_auth_token');
}

/**
 * Universal API Request Handler
 */
export async function apiRequest(endpoint, { method = 'GET', body = null, headers = {} } = {}) {
  const token = getAuthToken();

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
    const res = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data?.message || data?.errors?.[0]?.message || `Request failed with status ${res.status}`;
      const error = new Error(errorMsg);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    throw err;
  }
}
