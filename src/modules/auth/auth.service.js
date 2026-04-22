import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import config from '../../config/env.js';
import redis from '../../config/redis.js';
import logger from '../../shared/utils/logger.js';
import { 
  ConflictError, 
  UnauthorizedError, 
  ValidationError,
  NotFoundError 
} from '../../shared/errors/index.js';
import {
  generateAccessToken,
  generateTokens,
  revokeAllUserRefreshTokens,
  revokeRefreshToken,
  verifyRefreshToken,
  blacklistAccessToken,
} from './token.service.js';
import { seedSystemAccounts } from '../../accounting/accounts.service.js';

/**
 * Auth Service
 * Handles user registration, login, and authentication logic
 */

/**
 * Register a new user with organization
 * Atomic transaction: creates user, org, role, billing settings, and system accounts
 * 
 * @param {Object} params
 * @param {string} params.email - User email
 * @param {string} params.password - User password
 * @param {string} params.name - User name
 * @param {string} params.organizationName - Organization name
 * @param {string} params.organizationSlug - Organization slug (optional)
 * @returns {Promise<Object>} User, organization, and tokens
 */
export async function register({ email, password, name, organizationName, organizationSlug }) {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  
  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }
  
  // Generate slug if not provided
  const slug = organizationSlug || generateSlug(organizationName);
  
  // Check if slug is available
  const existingOrg = await prisma.organization.findUnique({
    where: { slug },
  });
  
  if (existingOrg) {
    throw new ConflictError(`Organization slug "${slug}" is already taken`);
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds || 12);
  
  // Create everything in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create user
    const user = await tx.user.create({
      data: {
        email,
        password_hash: passwordHash,
        name,
        status: 'ACTIVE',
      },
    });
    
    // 2. Create organization
    const organization = await tx.organization.create({
      data: {
        name: organizationName,
        slug,
        status: 'ACTIVE',
      },
    });
    
    // 3. Create user-organization role (OWNER)
    await tx.userOrganizationRole.create({
      data: {
        user_id: user.id,
        organization_id: organization.id,
        role: 'OWNER',
      },
    });
    
    // 4. Create billing settings
    await tx.billingSettings.create({
      data: {
        organization_id: organization.id,
        currency: 'USD',
        timezone: 'UTC',
        invoice_prefix: 'INV',
        invoice_sequence: 0,
        payment_terms_days: 30,
        tax_rate_bps: 0,
        dunning_enabled: true,
        dunning_retry_days: [3, 7, 14],
      },
    });
    
    // 5. Seed system accounts (4 accounts: Cash, AR, Deferred Revenue, Subscription Revenue)
    await seedSystemAccounts(organization.id, tx);
    
    logger.info('Organization registered', {
      organizationId: organization.id,
      userId: user.id,
      organizationName,
    });
    
    return { user, organization };
  });
  
  // Generate tokens
  const tokens = await generateTokens(result.user, result.organization, 'OWNER');
  
  // Don't return password hash
  const { password_hash, ...userWithoutPassword } = result.user;
  
  return {
    user: userWithoutPassword,
    organization: result.organization,
    ...tokens,
  };
}

/**
 * Generate slug from name
 * @param {string} name - Organization name
 * @returns {string} Slug
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/**
 * Login user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User, organization, and tokens
 */
export async function login(email, password) {
  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });
  
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }
  
  if (user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Account is suspended. Please contact support');
  }
  
  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid email or password');
  }
  
  // Get user's default organization (first active one)
  const userOrgRole = await prisma.userOrganizationRole.findFirst({
    where: {
      user_id: user.id,
      organization: {
        status: 'ACTIVE',
        deleted_at: null,
      },
    },
    include: {
      organization: true,
    },
  });
  
  if (!userOrgRole) {
    throw new UnauthorizedError('No active organization found for this user');
  }
  
  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });
  
  // Generate tokens
  const tokens = await generateTokens(user, userOrgRole.organization, userOrgRole.role);
  
  // Don't return password hash
  const { password_hash, ...userWithoutPassword } = user;
  
  logger.info('User logged in', {
    userId: user.id,
    organizationId: userOrgRole.organization.id,
  });
  
  return {
    user: userWithoutPassword,
    organization: userOrgRole.organization,
    role: userOrgRole.role,
    ...tokens,
  };
}

/**
 * Logout user
 * @param {string} refreshToken - Refresh token to revoke
 * @param {string} accessToken - Access token to blacklist (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function logout(refreshToken, accessToken = null) {
  await revokeRefreshToken(refreshToken);
  
  if (accessToken) {
    await blacklistAccessToken(accessToken);
  }
  
  logger.info('User logged out', { refreshToken: refreshToken.slice(0, 10) });
  return true;
}

/**
 * Refresh access token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New tokens
 */
export async function refreshToken(refreshToken) {
  const tokenData = await verifyRefreshToken(refreshToken);
  
  // Get user
  const user = await prisma.user.findUnique({
    where: { id: tokenData.userId },
  });
  
  if (!user || user.status !== 'ACTIVE') {
    throw new UnauthorizedError('User not found or inactive');
  }
  
  // Get organization
  const organization = await prisma.organization.findUnique({
    where: { id: tokenData.organizationId },
  });
  
  if (!organization || organization.status !== 'ACTIVE') {
    throw new UnauthorizedError('Organization not found or inactive');
  }
  
  // Generate new access token
  const newAccessToken = generateAccessToken({
    userId: user.id,
    organizationId: organization.id,
    role: tokenData.role,
    email: user.email,
  });
  
  logger.info('Token refreshed', {
    userId: user.id,
    organizationId: organization.id,
  });
  
  return {
    accessToken: newAccessToken,
    refreshToken, // Keep same refresh token
    expiresIn: 15 * 60,
    tokenType: 'Bearer',
  };
}

/**
 * Get current user with organization context
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} User with role
 */
export async function getCurrentUser(userId, organizationId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      last_login_at: true,
      created_at: true,
    },
  });
  
  if (!user) {
    throw new NotFoundError('User');
  }
  
  const userOrgRole = await prisma.userOrganizationRole.findFirst({
    where: {
      user_id: userId,
      organization_id: organizationId,
    },
    select: {
      role: true,
      created_at: true,
    },
  });
  
  if (!userOrgRole) {
    throw new UnauthorizedError('User does not have access to this organization');
  }
  
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
  });
  
  return {
    ...user,
    role: userOrgRole.role,
    organization,
  };
}

/**
 * Change user password
 * @param {string} userId - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} Success status
 */
export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  
  if (!user) {
    throw new NotFoundError('User');
  }
  
  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }
  
  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds || 12);
  
  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password_hash: newPasswordHash },
  });
  
  logger.info('Password changed', { userId });
  return true;
}

/**
 * Forgot password - generate reset token
 * @param {string} email - User email
 * @returns {Promise<Object>} Reset token (in production, this would be emailed)
 */
export async function forgotPassword(email) {
  const user = await prisma.user.findUnique({
    where: { email },
  });
  
  if (!user) {
    // Don't reveal that user doesn't exist for security
    logger.info('Password reset requested for non-existent email', { email });
    return { message: 'If an account exists, a password reset link will be sent' };
  }
  
  // Generate reset token (store in Redis with TTL)
  const resetToken = crypto.randomBytes(32).toString('hex');
  await redis.setex(`password_reset:${resetToken}`, 3600, user.id); // 1 hour TTL
  
  logger.info('Password reset token generated', { userId: user.id, email });
  
  // In production, send email with reset link
  // For now, return token for testing
  return {
    message: 'Password reset instructions sent to your email',
    resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
  };
}

/**
 * Reset password using token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} Success status
 */
export async function resetPassword(token, newPassword) {
  const userId = await redis.get(`password_reset:${token}`);
  
  if (!userId) {
    throw new ValidationError('Invalid or expired reset token');
  }
  
  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds || 12);
  
  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password_hash: newPasswordHash },
  });
  
  // Delete used token
  await redis.del(`password_reset:${token}`);
  
  // Revoke all refresh tokens for security
  await revokeAllUserRefreshTokens(userId);
  
  logger.info('Password reset completed', { userId });
  return true;
}

export default {
  register,
  login,
  logout,
  refreshToken,
  getCurrentUser,
  changePassword,
  forgotPassword,
  resetPassword,
};
