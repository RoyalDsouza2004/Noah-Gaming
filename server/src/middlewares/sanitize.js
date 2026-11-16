/**
 * NoSQL Injection Protection Middleware
 * Recursively sanitizes request body, query params, and route parameters by stripping
 * any keys that begin with '$' (MongoDB operators) or contain '.' (path traversal).
 */

function cleanObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => cleanObject(item));
  }

  const cleaned = {};
  for (const key of Object.keys(obj)) {
    // Strip operators like $gt, $ne, $where and dot-separated paths
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    cleaned[key] = cleanObject(obj[key]);
  }
  return cleaned;
}

export const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = cleanObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = cleanObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = cleanObject(req.params);
  }
  next();
};
