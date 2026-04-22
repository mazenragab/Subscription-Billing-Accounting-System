import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../shared/errors/index.js';

/**
 * Organizations Repository
 * Handles database operations for organizations
 */

/**
 * Get organization by ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Organization
 */
export async function getOrganizationById(organizationId) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      billing_settings: true,
    },
  });
  
  if (!organization) {
    throw new NotFoundError('Organization');
  }
  
  return organization;
}

/**
 * Get organization by slug
 * @param {string} slug - Organization slug
 * @returns {Promise<Object|null>} Organization or null
 */
export async function getOrganizationBySlug(slug) {
  return await prisma.organization.findUnique({
    where: { slug },
    include: {
      billing_settings: true,
    },
  });
}

/**
 * Update organization
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated organization
 */
export async function updateOrganization(organizationId, data) {
  // Check if slug is being changed and if it's available
  if (data.slug) {
    const existing = await prisma.organization.findFirst({
      where: {
        slug: data.slug,
        id: { not: organizationId },
      },
    });
    
    if (existing) {
      throw new Error(`Organization slug "${data.slug}" is already taken`);
    }
  }
  
  return await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...data,
      updated_at: new Date(),
    },
    include: {
      billing_settings: true,
    },
  });
}

/**
 * Get billing settings for organization
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Billing settings
 */
export async function getBillingSettings(organizationId) {
  const settings = await prisma.billingSettings.findUnique({
    where: { organization_id: organizationId },
  });
  
  if (!settings) {
    throw new NotFoundError('Billing settings');
  }
  
  return settings;
}

/**
 * Update billing settings
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated billing settings
 */
export async function updateBillingSettings(organizationId, data) {
  return await prisma.billingSettings.update({
    where: { organization_id: organizationId },
    data: {
      ...data,
      updated_at: new Date(),
    },
  });
}

/**
 * Get organization members with roles
 * @param {string} organizationId - Organization ID
 * @param {Object} pagination - Pagination params
 * @returns {Promise<Object>} Members with pagination
 */
export async function getOrganizationMembers(organizationId, { limit = 20, cursor = null }) {
  const where = {
    organization_id: organizationId,
  };
  
  if (cursor) {
    where.id = { gt: cursor };
  }
  
  const members = await prisma.userOrganizationRole.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          last_login_at: true,
          created_at: true,
        },
      },
    },
    orderBy: { created_at: 'asc' },
    take: limit + 1,
  });
  
  const hasNextPage = members.length > limit;
  const data = hasNextPage ? members.slice(0, limit) : members;
  const nextCursor = hasNextPage && data.length > 0 ? data[data.length - 1].id : null;
  
  return {
    data,
    pagination: {
      limit,
      hasNextPage,
      nextCursor,
      count: data.length,
    },
  };
}

/**
 * Get user role in organization
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User role
 */
export async function getUserRole(organizationId, userId) {
  return await prisma.userOrganizationRole.findFirst({
    where: {
      organization_id: organizationId,
      user_id: userId,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
        },
      },
    },
  });
}

/**
 * Add user to organization
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<Object>} User organization role
 */
export async function addUserToOrganization(organizationId, userId, role) {
  return await prisma.userOrganizationRole.create({
    data: {
      organization_id: organizationId,
      user_id: userId,
      role,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
        },
      },
    },
  });
}

/**
 * Update user role in organization
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User ID
 * @param {string} role - New role
 * @returns {Promise<Object>} Updated user organization role
 */
export async function updateUserRole(organizationId, userId, role) {
  const userRole = await prisma.userOrganizationRole.findFirst({
    where: {
      organization_id: organizationId,
      user_id: userId,
    },
  });
  
  if (!userRole) {
    throw new NotFoundError('User not found in organization');
  }
  
  // Prevent changing OWNER role
  if (userRole.role === 'OWNER') {
    throw new Error('Cannot change role of organization owner');
  }
  
  return await prisma.userOrganizationRole.update({
    where: { id: userRole.id },
    data: { role },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
        },
      },
    },
  });
}

/**
 * Remove user from organization
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
export async function removeUserFromOrganization(organizationId, userId) {
  const userRole = await prisma.userOrganizationRole.findFirst({
    where: {
      organization_id: organizationId,
      user_id: userId,
    },
  });
  
  if (!userRole) {
    throw new NotFoundError('User not found in organization');
  }
  
  // Prevent removing OWNER
  if (userRole.role === 'OWNER') {
    throw new Error('Cannot remove organization owner. Transfer ownership first.');
  }
  
  await prisma.userOrganizationRole.delete({
    where: { id: userRole.id },
  });
  
  return true;
}

/**
 * Check if user has specific role in organization
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User ID
 * @param {Array<string>} roles - Allowed roles
 * @returns {Promise<boolean>} Whether user has role
 */
export async function userHasRole(organizationId, userId, roles) {
  const userRole = await prisma.userOrganizationRole.findFirst({
    where: {
      organization_id: organizationId,
      user_id: userId,
      role: { in: roles },
    },
  });
  
  return !!userRole;
}

/**
 * Get organization statistics
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Organization stats
 */
export async function getOrganizationStats(organizationId) {
  const [
    customersCount,
    activeSubscriptionsCount,
    plansCount,
    invoicesCount,
    revenueYtd,
  ] = await Promise.all([
    prisma.customer.count({
      where: {
        organization_id: organizationId,
        deleted_at: null,
      },
    }),
    prisma.subscription.count({
      where: {
        organization_id: organizationId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
    }),
    prisma.plan.count({
      where: {
        organization_id: organizationId,
        deleted_at: null,
      },
    }),
    prisma.invoice.count({
      where: {
        organization_id: organizationId,
        created_at: {
          gte: new Date(new Date().getFullYear(), 0, 1),
        },
      },
    }),
    prisma.invoice.aggregate({
      where: {
        organization_id: organizationId,
        status: 'PAID',
        paid_at: {
          gte: new Date(new Date().getFullYear(), 0, 1),
        },
      },
      _sum: {
        total_cents: true,
      },
    }),
  ]);
  
  return {
    customersCount,
    activeSubscriptionsCount,
    plansCount,
    invoicesCount,
    revenueYtdCents: revenueYtd._sum.total_cents || 0,
  };
}

export default {
  getOrganizationById,
  getOrganizationBySlug,
  updateOrganization,
  getBillingSettings,
  updateBillingSettings,
  getOrganizationMembers,
  getUserRole,
  addUserToOrganization,
  updateUserRole,
  removeUserFromOrganization,
  userHasRole,
  getOrganizationStats,
};