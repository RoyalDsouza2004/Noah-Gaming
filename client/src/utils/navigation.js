/**
 * Universal Route Navigator for NOAH GAMING SPA
 * Replaces hash-based navigation (#home, #book) with clean modern URLs (/home, /book)
 */

export const navigate = (path, replace = false) => {
  if (typeof window === 'undefined') return;
  const target = path ? (path.startsWith('/') ? path : `/${path}`) : '/';
  if (replace) {
    window.history.replaceState(null, '', target);
  } else {
    window.history.pushState(null, '', target);
  }
  window.dispatchEvent(new Event('popstate'));
  window.dispatchEvent(new Event('routechange'));
};

export const getRoutePath = () => {
  if (typeof window === 'undefined') return 'home';

  // 1. If legacy hash is present in URL (e.g. #book), migrate it to clean path and clear hash
  if (window.location.hash) {
    const cleanFromHash = window.location.hash.replace(/^#\/?/, '').trim();
    if (cleanFromHash) {
      const cleanPath = `/${cleanFromHash}`;
      window.history.replaceState(null, '', cleanPath);
      return cleanFromHash.toLowerCase();
    } else {
      window.history.replaceState(null, '', '/');
    }
  }

  // 2. Return clean pathname (e.g. "book", "pricing", "admin", "admin-pricing")
  const path = (window.location.pathname || '/').toLowerCase().replace(/^\/+/, '').replace(/\/+$/, '');
  return path || 'home';
};
