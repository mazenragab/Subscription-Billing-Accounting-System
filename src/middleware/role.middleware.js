import { ForbiddenError, UnauthorizedError } from '../shared/errors/index.js';

/**
 * Enforce allowed roles for route handlers.
 * Must run after authMiddleware.
 *
 * @param {string[]} allowedRoles
 * @returns {import('express').RequestHandler}
 */
export function requireRoles(allowedRoles = []) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userRole = req.user.role;
    if (!userRole) {
      return next(new ForbiddenError('User role is missing in token context'));
    }

    if (!allowedRoles.includes(userRole)) {
      return next(new ForbiddenError('Insufficient permissions for this operation'));
    }

    next();
  };
}

export default {
  requireRoles,
};
