import { ROLES } from '../config/constants.js';

/**
 * Restrict access to specified roles
 * @param  {...string} allowedRoles - 'customer', 'receptionist', 'admin'
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before role verification.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user.role}' is not authorized to access this resource.`,
      });
    }

    next();
  };
};

export const requireAdmin = authorize(ROLES.ADMIN);
export const requireStaff = authorize(ROLES.RECEPTIONIST, ROLES.ADMIN);
export const requireCustomer = authorize(ROLES.CUSTOMER, ROLES.RECEPTIONIST, ROLES.ADMIN);

/**
 * Check if a user is the designated Primary Administrator
 * @param {object} user - User document or auth payload
 * @returns {boolean}
 */
export const isUserPrimaryAdmin = (user) => {
  if (!user) return false;
  if (user.isPrimaryAdmin === true) return true;
  const configuredEmail = process.env.PRIMARY_ADMIN_EMAIL?.trim()?.toLowerCase();
  if (configuredEmail && user.email && user.email.trim().toLowerCase() === configuredEmail) {
    return true;
  }
  return false;
};

/**
 * Strict authorization middleware for Primary Admin-only actions
 */
export const requirePrimaryAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required before permission verification.',
    });
  }

  if (req.user.role !== ROLES.ADMIN || !isUserPrimaryAdmin(req.user)) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. This action strictly requires Primary Administrator privileges.',
    });
  }

  next();
};
