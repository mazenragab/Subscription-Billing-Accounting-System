import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../shared/errors/index.js';

/**
 * Plans Repository
 * Handles database operations for plans and plan features
 */

/**
 * Get plan by ID with tenant isolation
 * @param {string} organizationId - Organization ID
 * @param {string} planId - Plan ID
 * @returns {Promise<Object>} Plan with features
 */
export async function getPlanById(organizationId, planId) {
  const plan = await prisma.plan.findFirst({
    where: {
      id: planId,
      organization_id: organizationId,
      deleted_at: null,
    },
    include: {
      features: true,
      _count: {
        select: {
          subscriptions: {
            where: {
              status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
            },
          },
        },
      },
    },
  });
  
  if (!plan) {
    throw new NotFoundError('Plan');
  }
  
  return plan;
}

/**
 * Get plan by name with tenant isolation
 * @param {string} organizationId - Organization ID
 * @param {string} name - Plan name
 * @returns {Promise<Object|null>} Plan or null
 */
export async function getPlanByName(organizationId, name) {
  return await prisma.plan.findFirst({
    where: {
      organization_id: organizationId,
      name,
      deleted_at: null,
    },
  });
}

/**
 * List plans with pagination and filters
 * @param {string} organizationId - Organization ID
 * @param {Object} filters - Filters (is_active, is_public, interval, search)
 * @param {Object} pagination - Pagination params
 * @returns {Promise<Object>} Plans with pagination
 */
export async function listPlans(organizationId, filters = {}, pagination = {}) {
  const { is_active, is_public, interval, search } = filters;
  const { limit = 20, cursor = null } = pagination;
  
  const where = {
    organization_id: organizationId,
    deleted_at: null,
  };
  
  if (is_active !== undefined) {
    where.is_active = is_active;
  }
  
  if (is_public !== undefined) {
    where.is_public = is_public;
  }
  
  if (interval) {
    where.interval = interval;
  }
  
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }
  
  if (cursor) {
    where.id = { gt: cursor };
  }
  
  const plans = await prisma.plan.findMany({
    where,
    include: {
      features: true,
      _count: {
        select: {
          subscriptions: {
            where: {
              status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
            },
          },
        },
      },
    },
    orderBy: [
      { sort_order: 'asc' },
      { created_at: 'asc' },
    ],
    take: limit + 1,
  });
  
  const hasNextPage = plans.length > limit;
  const data = hasNextPage ? plans.slice(0, limit) : plans;
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
 * Create plan
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Plan data
 * @returns {Promise<Object>} Created plan
 */
export async function createPlan(organizationId, data) {
  // Check for duplicate name
  const existing = await getPlanByName(organizationId, data.name);
  if (existing) {
    throw new ConflictError(`Plan with name "${data.name}" already exists`);
  }
  
  return await prisma.plan.create({
    data: {
      organization_id: organizationId,
      name: data.name,
      description: data.description,
      amount_cents: data.amount_cents,
      currency: data.currency,
      interval: data.interval,
      trial_days: data.trial_days || 0,
      is_active: data.is_active !== undefined ? data.is_active : true,
      is_public: data.is_public !== undefined ? data.is_public : true,
      sort_order: data.sort_order || 0,
    },
    include: {
      features: true,
    },
  });
}

/**
 * Update plan
 * @param {string} organizationId - Organization ID
 * @param {string} planId - Plan ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated plan
 */
export async function updatePlan(organizationId, planId, data) {
  // Verify plan exists
  await getPlanById(organizationId, planId);
  
  // Check for duplicate name if changing
  if (data.name) {
    const existing = await prisma.plan.findFirst({
      where: {
        organization_id: organizationId,
        name: data.name,
        id: { not: planId },
        deleted_at: null,
      },
    });
    
    if (existing) {
      throw new ConflictError(`Plan with name "${data.name}" already exists`);
    }
  }
  
  return await prisma.plan.update({
    where: { id: planId },
    data: {
      ...data,
      updated_at: new Date(),
    },
    include: {
      features: true,
    },
  });
}

/**
 * Soft delete plan
 * @param {string} organizationId - Organization ID
 * @param {string} planId - Plan ID
 * @returns {Promise<boolean>} Success status
 */
export async function deletePlan(organizationId, planId) {
  const plan = await getPlanById(organizationId, planId);
  
  // Check for active subscriptions using this plan
  const activeSubscriptions = await prisma.subscription.count({
    where: {
      plan_id: planId,
      status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
    },
  });
  
  if (activeSubscriptions > 0) {
    throw new ConflictError('Cannot delete plan with active subscriptions. Deactivate it instead.');
  }
  
  await prisma.plan.update({
    where: { id: planId },
    data: {
      deleted_at: new Date(),
      is_active: false,
      updated_at: new Date(),
    },
  });
  
  return true;
}

/**
 * Get plan features
 * @param {string} organizationId - Organization ID
 * @param {string} planId - Plan ID
 * @returns {Promise<Array>} Plan features
 */
export async function getPlanFeatures(organizationId, planId) {
  await getPlanById(organizationId, planId);
  
  return await prisma.planFeature.findMany({
    where: { plan_id: planId },
    orderBy: { feature_key: 'asc' },
  });
}

/**
 * Create plan feature
 * @param {string} organizationId - Organization ID
 * @param {string} planId - Plan ID
 * @param {Object} data - Feature data
 * @returns {Promise<Object>} Created feature
 */
export async function createPlanFeature(organizationId, planId, data) {
  await getPlanById(organizationId, planId);
  
  // Check for duplicate feature key
  const existing = await prisma.planFeature.findFirst({
    where: {
      plan_id: planId,
      feature_key: data.feature_key,
    },
  });
  
  if (existing) {
    throw new ConflictError(`Feature "${data.feature_key}" already exists for this plan`);
  }
  
  return await prisma.planFeature.create({
    data: {
      plan_id: planId,
      feature_key: data.feature_key,
      feature_value: data.feature_value,
    },
  });
}

/**
 * Update plan feature
 * @param {string} organizationId - Organization ID
 * @param {string} planId - Plan ID
 * @param {string} featureKey - Feature key
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated feature
 */
export async function updatePlanFeature(organizationId, planId, featureKey, data) {
  await getPlanById(organizationId, planId);
  
  const feature = await prisma.planFeature.findFirst({
    where: {
      plan_id: planId,
      feature_key: featureKey,
    },
  });
  
  if (!feature) {
    throw new NotFoundError(`Feature "${featureKey}"`);
  }
  
  return await prisma.planFeature.update({
    where: { id: feature.id },
    data: {
      feature_value: data.feature_value,
    },
  });
}

/**
 * Delete plan feature
 * @param {string} organizationId - Organization ID
 * @param {string} planId - Plan ID
 * @param {string} featureKey - Feature key
 * @returns {Promise<boolean>} Success status
 */
export async function deletePlanFeature(organizationId, planId, featureKey) {
  await getPlanById(organizationId, planId);
  
  const feature = await prisma.planFeature.findFirst({
    where: {
      plan_id: planId,
      feature_key: featureKey,
    },
  });
  
  if (!feature) {
    throw new NotFoundError(`Feature "${featureKey}"`);
  }
  
  await prisma.planFeature.delete({
    where: { id: feature.id },
  });
  
  return true;
}

/**
 * Get public plans (available for subscription)
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array>} Public plans
 */
export async function getPublicPlans(organizationId) {
  return await prisma.plan.findMany({
    where: {
      organization_id: organizationId,
      is_active: true,
      is_public: true,
      deleted_at: null,
    },
    include: {
      features: true,
    },
    orderBy: [
      { sort_order: 'asc' },
      { amount_cents: 'asc' },
    ],
  });
}

export default {
  getPlanById,
  getPlanByName,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getPlanFeatures,
  createPlanFeature,
  updatePlanFeature,
  deletePlanFeature,
  getPublicPlans,
};