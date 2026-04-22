import express from 'express';
import {
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
} from './plans.controller.js';
import {
  createPlanSchema,
  updatePlanSchema,
  createPlanFeatureSchema,
  listPlansSchema,
} from './plans.schema.js';
import validateMiddleware from '../../middleware/validate.middleware.js';
import authMiddleware from '../../middleware/auth.middleware.js';
import tenantMiddleware from '../../middleware/tenant.middleware.js';
import { requireRoles } from '../../middleware/role.middleware.js';

const router = express.Router();

// All plan routes require auth and tenant context
router.use(authMiddleware, tenantMiddleware);

/**
 * @route GET /api/v1/plans
 * @desc List plans with pagination and filters
 * @access Private
 */
router.get(
  '/',
  validateMiddleware({ query: listPlansSchema }),
  listPlans
);

/**
 * @route GET /api/v1/plans/public
 * @desc Get public plans (available for subscription)
 * @access Private
 */
router.get('/public', getPublicPlans);

/**
 * @route POST /api/v1/plans
 * @desc Create a new plan
 * @access Private (OWNER, ADMIN)
 */
router.post(
  '/',
  requireRoles(['OWNER', 'ADMIN']),
  validateMiddleware({ body: createPlanSchema }),
  createPlan
);

/**
 * @route GET /api/v1/plans/:id
 * @desc Get plan by ID
 * @access Private
 */
router.get('/:id', getPlanById);

/**
 * @route PATCH /api/v1/plans/:id
 * @desc Update plan
 * @access Private (OWNER, ADMIN)
 */
router.patch(
  '/:id',
  requireRoles(['OWNER', 'ADMIN']),
  validateMiddleware({ body: updatePlanSchema }),
  updatePlan
);

/**
 * @route DELETE /api/v1/plans/:id
 * @desc Soft delete plan
 * @access Private (OWNER, ADMIN)
 */
router.delete('/:id', requireRoles(['OWNER', 'ADMIN']), deletePlan);

/**
 * @route GET /api/v1/plans/:id/features
 * @desc Get plan features
 * @access Private
 */
router.get('/:id/features', getPlanFeatures);

/**
 * @route POST /api/v1/plans/:id/features
 * @desc Create plan feature
 * @access Private (OWNER, ADMIN)
 */
router.post(
  '/:id/features',
  requireRoles(['OWNER', 'ADMIN']),
  validateMiddleware({ body: createPlanFeatureSchema }),
  createPlanFeature
);

/**
 * @route PATCH /api/v1/plans/:id/features/:featureKey
 * @desc Update plan feature
 * @access Private (OWNER, ADMIN)
 */
router.patch(
  '/:id/features/:featureKey',
  requireRoles(['OWNER', 'ADMIN']),
  validateMiddleware({ body: createPlanFeatureSchema }),
  updatePlanFeature
);

/**
 * @route DELETE /api/v1/plans/:id/features/:featureKey
 * @desc Delete plan feature
 * @access Private (OWNER, ADMIN)
 */
router.delete('/:id/features/:featureKey', requireRoles(['OWNER', 'ADMIN']), deletePlanFeature);

export default router;