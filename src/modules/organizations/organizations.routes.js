import express from 'express';
import {
  getCurrentOrg,
  updateCurrentOrg,
  getBillingSettings,
  updateBillingSettings,
  getMembers,
  inviteUserToOrg,
  updateMemberRole,
  removeMember,
  getStats,
  transferOwnershipController,
} from './organizations.controller.js';
import {
  updateOrganizationSchema,
  updateBillingSettingsSchema,
  inviteUserSchema,
  updateUserRoleSchema,
} from './organizations.schema.js';
import validateMiddleware from '../../middleware/validate.middleware.js';
import authMiddleware from '../../middleware/auth.middleware.js';
import tenantMiddleware from '../../middleware/tenant.middleware.js';

const router = express.Router();

// All organization routes require auth and tenant context
router.use(authMiddleware, tenantMiddleware);

/**
 * @route GET /api/v1/organizations/current
 * @desc Get current organization
 * @access Private
 */
router.get('/current', getCurrentOrg);

/**
 * @route PATCH /api/v1/organizations/current
 * @desc Update current organization
 * @access Private (OWNER, ADMIN)
 */
router.patch(
  '/current',
  validateMiddleware({ body: updateOrganizationSchema }),
  updateCurrentOrg
);

/**
 * @route GET /api/v1/organizations/current/billing-settings
 * @desc Get billing settings
 * @access Private
 */
router.get('/current/billing-settings', getBillingSettings);

/**
 * @route PATCH /api/v1/organizations/current/billing-settings
 * @desc Update billing settings
 * @access Private (OWNER, ADMIN)
 */
router.patch(
  '/current/billing-settings',
  validateMiddleware({ body: updateBillingSettingsSchema }),
  updateBillingSettings
);

/**
 * @route GET /api/v1/organizations/current/members
 * @desc Get organization members
 * @access Private
 */
router.get('/current/members', getMembers);

/**
 * @route POST /api/v1/organizations/current/members
 * @desc Invite user to organization
 * @access Private (OWNER, ADMIN)
 */
router.post(
  '/current/members',
  validateMiddleware({ body: inviteUserSchema }),
  inviteUserToOrg
);

/**
 * @route PATCH /api/v1/organizations/current/members/:userId
 * @desc Update member role
 * @access Private (OWNER, ADMIN)
 */
router.patch(
  '/current/members/:userId',
  validateMiddleware({ body: updateUserRoleSchema }),
  updateMemberRole
);

/**
 * @route DELETE /api/v1/organizations/current/members/:userId
 * @desc Remove member from organization
 * @access Private (OWNER, ADMIN)
 */
router.delete('/current/members/:userId', removeMember);

/**
 * @route GET /api/v1/organizations/current/stats
 * @desc Get organization statistics
 * @access Private
 */
router.get('/current/stats', getStats);

/**
 * @route POST /api/v1/organizations/current/transfer-ownership
 * @desc Transfer organization ownership
 * @access Private (OWNER only)
 */
router.post('/current/transfer-ownership', transferOwnershipController);

export default router;