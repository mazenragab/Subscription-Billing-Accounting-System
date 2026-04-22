import {
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
} from './plans.service.js';

/**
 * Plans Controller
 * Handles HTTP request/response for plan management
 */

/**
 * List plans
 */
export async function listPlans(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await listPlansService(organizationId, query);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get public plans (available for subscription)
 */
export async function getPublicPlans(req, res, next) {
  try {
    const organizationId = req.tenantId;
    
    const result = await getPublicPlansService(organizationId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get plan by ID
 */
export async function getPlanById(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    
    const result = await getPlan(organizationId, id);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create plan
 */
export async function createPlan(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await createPlanService(organizationId, data, userId);
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update plan
 */
export async function updatePlan(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await updatePlanService(organizationId, id, data, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete plan (soft delete)
 */
export async function deletePlan(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    
    await deletePlanService(organizationId, id, userId);
    
    res.status(200).json({
      success: true,
      message: 'Plan deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get plan features
 */
export async function getPlanFeatures(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    
    const result = await getPlanFeaturesService(organizationId, id);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create plan feature
 */
export async function createPlanFeature(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await createPlanFeatureService(organizationId, id, data, userId);
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update plan feature
 */
export async function updatePlanFeature(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id, featureKey } = req.params;
    const userId = req.user.userId;
    const { feature_value } = req.body;
    
    const result = await updatePlanFeatureService(organizationId, id, featureKey, { feature_value }, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete plan feature
 */
export async function deletePlanFeature(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id, featureKey } = req.params;
    const userId = req.user.userId;
    
    await deletePlanFeatureService(organizationId, id, featureKey, userId);
    
    res.status(200).json({
      success: true,
      message: 'Plan feature deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

export default {
  listPlans,
  getPublicPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  getPlanFeatures,
  createPlanFeature,
  updatePlanFeature,
  deletePlanFeature,
};