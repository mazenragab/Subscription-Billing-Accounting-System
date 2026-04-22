import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { UnauthorizedError } from '../shared/errors/index.js';

/**
 * Verifies the JWT access token on every protected route.
 * Attaches decoded user payload to req.user.
 *
 * Expected JWT payload:
 *   { userId, organizationId, role, email }
 *
 * Usage: router.use(authMiddleware)
 *   or:  router.get('/path', authMiddleware, tenantMiddleware, handler)
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Access token expired'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid access token'));
    }
    next(new UnauthorizedError('Token verification failed'));
  }
};

export default authMiddleware;