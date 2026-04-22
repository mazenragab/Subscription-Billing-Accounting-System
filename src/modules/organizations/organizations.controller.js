import {
  getCurrentOrganization,
  updateCurrentOrganization,
  getBillingSettingsService,
  updateBillingSettingsService,
  getOrganizationMembersService,
  inviteUser,
  updateUserRoleService,
  removeUser,
  getOrganizationStatsService,
  transferOwnership,
} from './organizations.service.js';

/**
 * Organizations Controller
 * Handles HTTP request/response for organization management
 */

/**
 * Get current organization
 */
export async function getCurrentOrg(req, res, next) {
  try {
    const organizationId = req.tenantId;
    
    const result = await getCurrentOrganization(organizationId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update current organization
 */
export async function updateCurrentOrg(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await updateCurrentOrganization(organizationId, data, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get billing settings
 */
export async function getBillingSettings(req, res, next) {
  try {
    const organizationId = req.tenantId;
    
    const result = await getBillingSettingsService(organizationId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update billing settings
 */
export async function updateBillingSettings(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await updateBillingSettingsService(organizationId, data, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get organization members
 */
export async function getMembers(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const userId = req.user.userId;
    const { limit, cursor } = req.query;
    
    const pagination = {
      limit: limit ? parseInt(limit, 10) : 20,
      cursor: cursor || null,
    };
    
    const result = await getOrganizationMembersService(organizationId, pagination, userId);
    
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
 * Invite user to organization
 */
export async function inviteUserToOrg(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const invitedByUserId = req.user.userId;
    const { email, role } = req.body;
    
    const result = await inviteUser(organizationId, email, role, invitedByUserId);
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user role
 */
export async function updateMemberRole(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const actingUserId = req.user.userId;
    const { userId } = req.params;
    const { role } = req.body;
    
    const result = await updateUserRoleService(organizationId, userId, role, actingUserId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Remove user from organization
 */
export async function removeMember(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const actingUserId = req.user.userId;
    const { userId } = req.params;
    
    await removeUser(organizationId, userId, actingUserId);
    
    res.status(200).json({
      success: true,
      message: 'User removed from organization successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get organization statistics
 */
export async function getStats(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const userId = req.user.userId;
    
    const result = await getOrganizationStatsService(organizationId, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Transfer organization ownership
 */
export async function transferOwnershipController(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const currentOwnerUserId = req.user.userId;
    const { newOwnerUserId } = req.body;
    
    const result = await transferOwnership(organizationId, newOwnerUserId, currentOwnerUserId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export default {
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
};