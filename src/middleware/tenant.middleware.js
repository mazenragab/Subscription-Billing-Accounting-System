import { prisma } from '../config/database.js';
import redis from '../config/redis.js';
import { ForbiddenError, UnauthorizedError } from '../shared/errors/index.js';

const CACHE_TTL_SECONDS = 60;
const TENANT_CACHE_PREFIX = 'tenant_org:';

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

    const cacheKey = `${TENANT_CACHE_PREFIX}${organizationId}`;
    let org = null;

    // Cache read is best-effort. If Redis is unavailable, continue with database lookup.
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        org = JSON.parse(cached);
      }
    } catch (_error) {
      org = null;
    }

    if (!org) {
      org = await prisma.organization.findFirst({
        where: {
          id: organizationId,
          deleted_at: null,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          deleted_at: true,
        },
      });

      if (!org) {
        return next(new ForbiddenError('Organization not found or has been deleted'));
      }

      try {
        await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(org));
      } catch (_error) {
        // Ignore cache write errors and continue.
      }
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
