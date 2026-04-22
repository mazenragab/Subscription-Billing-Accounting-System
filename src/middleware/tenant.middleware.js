import { prisma } from '../config/database.js';
import { ForbiddenError, UnauthorizedError } from '../shared/errors/index.js';

// Simple in-memory cache (replace with Redis in production)
const orgCache = new Map();
const CACHE_TTL = 60000; // 60 seconds

/**
 * Extracts organizationId from verified JWT and verifies organization is active.
 * Attaches req.tenantId and req.tenant for use in downstream handlers.
 * Must run AFTER authMiddleware.
 *
 * Usage: router.get('/path', authMiddleware, tenantMiddleware, handler)
 */
const tenantMiddleware = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required before tenant resolution'));
    }

    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return next(new UnauthorizedError('No organization associated with user'));
    }

    // Check cache first
    let org = orgCache.get(organizationId);
    
    if (!org) {
      // Fetch from database
      org = await prisma.organization.findFirst({
        where: { 
          id: organizationId,
          deleted_at: null
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        }
      });

      if (!org) {
        return next(new ForbiddenError('Organization not found or has been deleted'));
      }

      // Cache the result
      orgCache.set(organizationId, org);
      setTimeout(() => orgCache.delete(organizationId), CACHE_TTL);
    }

    // Verify organization is active
    if (org.status !== 'ACTIVE') {
      return next(new ForbiddenError(`Organization is ${org.status.toLowerCase()}. Please contact support.`));
    }

    req.tenantId = organizationId;
    req.tenant = org;
    next();
  } catch (error) {
    next(error);
  }
};

export default tenantMiddleware;