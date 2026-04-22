import logger from '../../shared/utils/logger.js';
import {
  getPlanById,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getPlanFeatures,
  createPlanFeature,
  updatePlanFeature,
  deletePlanFeature,
  getPublicPlans,
} from './plans.repository.js';

/**
 * Plans Service
 * Handles business logic for plan management
 */

/**
 * Get plan by ID
 * @param {string} organizationId - Organization ID
 * @param {string} planId - Plan ID
 * @returns {Promise<Object>} Plan with features
 */
export async function getPlan(organizationId, planId) {
  return await getPlanById(organizationId, planId);
}

/**
 * List plans with filters
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Plans with pagination
 */
export async function listPlansService(organizationId, query) {
  const { limit, cursor, is_active, is_public, interval, search } = query;
  
  const filters = {};
  if (is_active !== undefined) filters.is_active = is_active === 'true';
  if (is_public !== undefined) filters.is_public = is_public === 'true';
  if (interval) filters.interval = interval;
  if (search) filters.search = search;
  
  const pagination = { limit, cursor };
  
  return await listPlans(organizationId, filters, pagination);
}

/**
 * Create new plan
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Plan data
 * @param {string} userId - User ID creating plan
 * @returns {Promise<Object>} Created plan
 */
export async function createPlanService(organizationId, data, userId) {
  const plan = await createPlan(organizationId, data);
  
  logger.info('Plan created', {
    organizationId,
    planId: plan.id,
    planName: plan.name,
    amountCents: plan.amount_cents,
    interval: plan.interval,
    userId,
  });
  
  return plan;
}

/**
 * Update plan
 * @param {string} organizationId - Organization ID
 * @param {string} planId - Plan ID
 * @param {Object} data - Update data
 * @param {string} userId - User ID updating plan
 * @returns {Promise<Object>} Updated plan
 */
export async function updatePlanService(organizationId, planId, data, userId) {
  const plan = await updatePlan(organizationId, planId, data);
  
  logger.info('Plan updated', {
    organizationId,
    planId,
    userId,
    updates: Object.keys(data),
  });
  
  return plan;
}

/**
 * Delete plan (soft delete)
 * @param {string} organizationId - Organization ID
 * @param {string} planId - Plan ID
 * @param {string} userId - User ID deleting plan
 * @returns {Promise<boolean>} Success status
 */
export async function deletePlanService(organizationId, planId, userId) {
  await deletePlan(organizationId, planId);
  
  logger.info('Plan deleted', {
    organizationId,
    planId,
    userId,
  });
  
  return true;
}

/**
 * Get plan features
 * @param {string} organizationId - Organization ID
 * @param {string} planId - Plan ID
 * @returns {Promise<Array>} Plan features
 */
export async function getPlanFeaturesService(organizationId, planId) {
  return await getPlanFeatures(organizationId, planId);
}

/**
 * Create plan feature
 * @param {string} organizationId - Organization ID
 * @param {string} planId - Plan ID
 * @param {Object} data - Feature data
 * @param {string} userId - User ID creating feature
 * @returns {Promise<Object>} Created feature
 */
export async function createPlanFeatureService(organizationId, planId, data, userId) {
  const feature = await createPlanFeature(organizationId, planId, data);
  
  logger.info('Plan feature created', {
    organizationId,
    planId,
    featureKey: feature.feature_key,
    userId,
  });
  
  return feature;
}

/**
 * Update plan feature
 * @param {string} organizationId - Organization ID
 * @param {string} planId - Plan ID
 * @param {string} featureKey - Feature key
 * @param {Object} data - Update data
 * @param {string} userId - User ID updating feature
 * @returns {Promise<Object>} Updated feature
 */
export async function updatePlanFeatureService(organizationId, planId, featureKey, data, userId) {
  const feature = await updatePlanFeature(organizationId, planId, featureKey, data);
  
  logger.info('Plan feature updated', {
    organizationId,
    planId,
    featureKey,
    userId,
  });
  
  return feature;
}

/**
 * Delete plan feature
 * @param {string} organizationId - Organization ID
 * @param {string} planId - Plan ID
 * @param {string} featureKey - Feature key
 * @param {string} userId - User ID deleting feature
 * @returns {Promise<boolean>} Success status
 */
export async function deletePlanFeatureService(organizationId, planId, featureKey, userId) {
  await deletePlanFeature(organizationId, planId, featureKey);
  
  logger.info('Plan feature deleted', {
    organizationId,
    planId,
    featureKey,
    userId,
  });
  
  return true;
}

/**
 * Get public plans (available for subscription)
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array>} Public plans
 */
export async function getPublicPlansService(organizationId) {
  return await getPublicPlans(organizationId);
}

export default {
  getPlan,
  listPlansService,
  createPlanService,
  updatePlanService,
  deletePlanService,
  getPlanFeaturesService,
  createPlanFeatureService,
  updatePlanFeatureService,
  deletePlanFeatureService,
  getPublicPlansService,
};