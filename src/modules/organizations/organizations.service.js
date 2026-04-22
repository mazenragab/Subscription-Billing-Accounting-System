import { prisma } from '../../config/database.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import logger from '../../shared/utils/logger.js';
import { ValidationError, ForbiddenError } from '../../shared/errors/index.js';
import {
  getOrganizationById,
  updateOrganization,
  getBillingSettings,
  updateBillingSettings,
  getOrganizationMembers,
  getUserRole,
  addUserToOrganization,
  updateUserRole,
  removeUserFromOrganization,
  getOrganizationStats,
} from './organizations.repository.js';

/**
 * Organizations Service
 * Handles business logic for organization management
 */

/**
 * Get current organization
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Organization with settings
 */
export async function getCurrentOrganization(organizationId) {
  const organization = await getOrganizationById(organizationId);
  
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    status: organization.status,
    created_at: organization.created_at,
    updated_at: organization.updated_at,
    billing_settings: organization.billing_settings,
  };
}

/**
 * Update current organization
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Update data
 * @param {string} userId - User ID making the change
 * @returns {Promise<Object>} Updated organization
 */
export async function updateCurrentOrganization(organizationId, data, userId) {
  // Check permissions (only OWNER and ADMIN can update org)
  const userRole = await getUserRole(organizationId, userId);
  if (!userRole || !['OWNER', 'ADMIN'].includes(userRole.role)) {
    throw new ForbiddenError('Insufficient permissions to update organization settings');
  }
  
  const organization = await updateOrganization(organizationId, data);
  
  logger.info('Organization updated', {
    organizationId,
    userId,
    updates: Object.keys(data),
  });
  
  return organization;
}

/**
 * Get billing settings
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Billing settings
 */
export async function getBillingSettingsService(organizationId) {
  return await getBillingSettings(organizationId);
}

/**
 * Update billing settings
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Update data
 * @param {string} userId - User ID making the change
 * @returns {Promise<Object>} Updated billing settings
 */
export async function updateBillingSettingsService(organizationId, data, userId) {
  // Check permissions (only OWNER and ADMIN can update billing settings)
  const userRole = await getUserRole(organizationId, userId);
  if (!userRole || !['OWNER', 'ADMIN'].includes(userRole.role)) {
    throw new ForbiddenError('Insufficient permissions to update billing settings');
  }
  
  const settings = await updateBillingSettings(organizationId, data);
  
  logger.info('Billing settings updated', {
    organizationId,
    userId,
    updates: Object.keys(data),
  });
  
  return settings;
}

/**
 * Get organization members
 * @param {string} organizationId - Organization ID
 * @param {Object} pagination - Pagination params
 * @param {string} userId - User ID requesting members
 * @returns {Promise<Object>} Members with pagination
 */
export async function getOrganizationMembersService(organizationId, pagination, userId) {
  // Check permissions (all authenticated users can view members)
  const userRole = await getUserRole(organizationId, userId);
  if (!userRole) {
    throw new ForbiddenError('You do not have access to this organization');
  }
  
  return await getOrganizationMembers(organizationId, pagination);
}

/**
 * Invite user to organization
 * @param {string} organizationId - Organization ID
 * @param {string} email - User email
 * @param {string} role - Role to assign
 * @param {string} invitedByUserId - User ID sending invitation
 * @returns {Promise<Object>} Invitation result
 */
export async function inviteUser(organizationId, email, role, invitedByUserId) {
  // Check permissions (only OWNER and ADMIN can invite)
  const userRole = await getUserRole(organizationId, invitedByUserId);
  if (!userRole || !['OWNER', 'ADMIN'].includes(userRole.role)) {
    throw new ForbiddenError('Insufficient permissions to invite users');
  }
  
  // Check if user exists
  let user = await prisma.user.findUnique({
    where: { email },
  });
  
  // If user doesn't exist, create a placeholder (will need to complete registration)
  if (!user) {
    // In production, send invitation email with registration link
    // For now, create a placeholder user with a temporary password
    const tempPassword = crypto.randomBytes(20).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    user = await prisma.user.create({
      data: {
        email,
        name: email.split('@')[0],
        password_hash: hashedPassword,
        status: 'ACTIVE',
      },
    });
    
    logger.info('New user created via invitation', {
      email,
      invitedBy: invitedByUserId,
    });
  }
  
  // Check if user already has role in this organization
  const existingRole = await getUserRole(organizationId, user.id);
  if (existingRole) {
    throw new ValidationError(`User already has role "${existingRole.role}" in this organization`);
  }
  
  // Add user to organization
  const result = await addUserToOrganization(organizationId, user.id, role);
  
  logger.info('User invited to organization', {
    organizationId,
    userId: user.id,
    email,
    role,
    invitedBy: invitedByUserId,
  });
  
  // In production, send invitation email
  return {
    user: result.user,
    role: result.role,
    message: `Invitation sent to ${email}`,
  };
}

/**
 * Update user role in organization
 * @param {string} organizationId - Organization ID
 * @param {string} targetUserId - User ID to update
 * @param {string} newRole - New role
 * @param {string} actingUserId - User ID making the change
 * @returns {Promise<Object>} Updated user role
 */
export async function updateUserRoleService(organizationId, targetUserId, newRole, actingUserId) {
  // Check permissions (only OWNER and ADMIN can update roles)
  const actingUserRole = await getUserRole(organizationId, actingUserId);
  if (!actingUserRole || !['OWNER', 'ADMIN'].includes(actingUserRole.role)) {
    throw new ForbiddenError('Insufficient permissions to update user roles');
  }
  
  // Get target user's current role
  const targetUserRole = await getUserRole(organizationId, targetUserId);
  if (!targetUserRole) {
    throw new ValidationError('User not found in organization');
  }
  
  // Prevent changing OWNER role
  if (targetUserRole.role === 'OWNER') {
    throw new ForbiddenError('Cannot change role of organization owner');
  }
  
  // Only OWNER can promote to ADMIN
  if (newRole === 'ADMIN' && actingUserRole.role !== 'OWNER') {
    throw new ForbiddenError('Only organization owner can promote users to ADMIN');
  }
  
  const result = await updateUserRole(organizationId, targetUserId, newRole);
  
  logger.info('User role updated', {
    organizationId,
    targetUserId,
    oldRole: targetUserRole.role,
    newRole,
    actingUserId,
  });
  
  return result;
}

/**
 * Remove user from organization
 * @param {string} organizationId - Organization ID
 * @param {string} targetUserId - User ID to remove
 * @param {string} actingUserId - User ID making the removal
 * @returns {Promise<boolean>} Success status
 */
export async function removeUser(organizationId, targetUserId, actingUserId) {
  // Check permissions (only OWNER and ADMIN can remove users)
  const actingUserRole = await getUserRole(organizationId, actingUserId);
  if (!actingUserRole || !['OWNER', 'ADMIN'].includes(actingUserRole.role)) {
    throw new ForbiddenError('Insufficient permissions to remove users');
  }
  
  // Get target user's role
  const targetUserRole = await getUserRole(organizationId, targetUserId);
  if (!targetUserRole) {
    throw new ValidationError('User not found in organization');
  }
  
  // Prevent removing OWNER
  if (targetUserRole.role === 'OWNER') {
    throw new ForbiddenError('Cannot remove organization owner. Transfer ownership first.');
  }
  
  // ADMIN cannot remove another ADMIN (only OWNER can)
  if (targetUserRole.role === 'ADMIN' && actingUserRole.role !== 'OWNER') {
    throw new ForbiddenError('Only organization owner can remove ADMIN users');
  }
  
  const result = await removeUserFromOrganization(organizationId, targetUserId);
  
  logger.info('User removed from organization', {
    organizationId,
    targetUserId,
    removedBy: actingUserId,
  });
  
  return result;
}

/**
 * Get organization statistics
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User ID requesting stats
 * @returns {Promise<Object>} Organization stats
 */
export async function getOrganizationStatsService(organizationId, userId) {
  // Check permissions
  const userRole = await getUserRole(organizationId, userId);
  if (!userRole) {
    throw new ForbiddenError('You do not have access to this organization');
  }
  
  return await getOrganizationStats(organizationId);
}

/**
 * Transfer organization ownership
 * @param {string} organizationId - Organization ID
 * @param {string} newOwnerUserId - User ID to transfer ownership to
 * @param {string} currentOwnerUserId - Current owner user ID
 * @returns {Promise<Object>} Transfer result
 */
export async function transferOwnership(organizationId, newOwnerUserId, currentOwnerUserId) {
  // Verify current user is owner
  const currentUserRole = await getUserRole(organizationId, currentOwnerUserId);
  if (!currentUserRole || currentUserRole.role !== 'OWNER') {
    throw new ForbiddenError('Only organization owner can transfer ownership');
  }
  
  // Verify new owner exists in organization
  const newUserRole = await getUserRole(organizationId, newOwnerUserId);
  if (!newUserRole) {
    throw new ValidationError('User not found in organization');
  }
  
  // Update roles in transaction
  await prisma.$transaction(async (tx) => {
    // Demote current owner to ADMIN
    await tx.userOrganizationRole.update({
      where: { id: currentUserRole.id },
      data: { role: 'ADMIN' },
    });
    
    // Promote new owner to OWNER
    await tx.userOrganizationRole.update({
      where: { id: newUserRole.id },
      data: { role: 'OWNER' },
    });
  });
  
  logger.info('Organization ownership transferred', {
    organizationId,
    previousOwner: currentOwnerUserId,
    newOwner: newOwnerUserId,
  });
  
  return {
    success: true,
    message: 'Organization ownership transferred successfully',
  };
}

export default {
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
};
