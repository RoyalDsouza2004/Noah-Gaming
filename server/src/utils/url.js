/**
 * Utility for resolving frontend application URLs across environments.
 * Prioritizes configured production domains and handles local development.
 */

export function getFrontendUrl(req = null) {
  // 1. Explicit environment variable FRONTEND_URL
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim()) {
    return process.env.FRONTEND_URL.trim().replace(/\/+$/, '');
  }

  // 2. Explicit environment variable CLIENT_URL
  if (process.env.CLIENT_URL && process.env.CLIENT_URL.trim()) {
    return process.env.CLIENT_URL.trim().replace(/\/+$/, '');
  }

  // 3. Request origin header (if available and valid)
  if (req && typeof req.get === 'function') {
    const origin = req.get('origin') || req.get('referer');
    if (origin && origin.startsWith('http')) {
      const cleanOrigin = origin.split('#')[0].split('?')[0].replace(/\/+$/, '');
      if (process.env.NODE_ENV === 'production') {
        if (!cleanOrigin.includes('localhost') && !cleanOrigin.includes('127.0.0.1')) {
          return cleanOrigin;
        }
      } else {
        return cleanOrigin;
      }
    }
  }

  // 4. Production fallback: Official deployed NOAH GAMING frontend domain
  if (process.env.NODE_ENV === 'production') {
    return 'https://client-ebon-ten-20.vercel.app';
  }

  // 5. Parse CORS_ORIGIN if provided
  if (process.env.CORS_ORIGIN) {
    const origins = process.env.CORS_ORIGIN.split(',').map((s) => s.trim());
    if (process.env.NODE_ENV === 'production') {
      const prodOrigin = origins.find(
        (o) => !o.includes('localhost') && !o.includes('127.0.0.1') && o.startsWith('http')
      );
      if (prodOrigin) return prodOrigin.replace(/\/+$/, '');
    } else {
      const devOrigin = origins.find((o) => o.startsWith('http'));
      if (devOrigin) return devOrigin.replace(/\/+$/, '');
    }
  }

  // 6. Default local development frontend port
  return 'http://localhost:5173';
}

/**
 * Builds a valid, safely encoded password-reset URL pointing to the deployed frontend.
 */
export function getPasswordResetUrl(token, req = null) {
  const baseUrl = getFrontendUrl(req);
  return `${baseUrl}#reset-password?token=${encodeURIComponent(token)}`;
}
