import logger from '../../shared/utils/logger.js';
import { ValidationError } from '../../shared/errors/index.js';
import {
  getDiscountCodeById,
  getDiscountCodeByCode,
  listDiscountCodes,
  createDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
  incrementDiscountCodeUsage,
  validateDiscountCode,
} from './discount-codes.repository.js';

/**
 * Discount Codes Service
 * Handles business logic for discount code management
 */

/**
 * Get discount code by ID
 * @param {string} organizationId - Organization ID
 * @param {string} discountCodeId - Discount code ID
 * @returns {Promise<Object>} Discount code
 */
export async function getDiscountCode(organizationId, discountCodeId) {
  return await getDiscountCodeById(organizationId, discountCodeId);
}

/**
 * Get discount code by code
 * @param {string} organizationId - Organization ID
 * @param {string} code - Discount code
 * @returns {Promise<Object|null>} Discount code
 */
export async function getDiscountCodeByCodeService(organizationId, code) {
  return await getDiscountCodeByCode(organizationId, code);
}

/**
 * List discount codes with filters
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Discount codes with pagination
 */
export async function listDiscountCodesService(organizationId, query) {
  const { limit, cursor, is_active, type } = query;
  
  const filters = {};
  if (is_active !== undefined) filters.is_active = is_active === 'true';
  if (type) filters.type = type;
  
  const pagination = { limit, cursor };
  
  return await listDiscountCodes(organizationId, filters, pagination);
}

/**
 * Create discount code
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Discount code data
 * @param {string} userId - User ID creating discount code
 * @returns {Promise<Object>} Created discount code
 */
export async function createDiscountCodeService(organizationId, data, userId) {
  // Validate percentage value
  if (data.type === 'PERCENTAGE' && data.value > 10000) {
    throw new ValidationError('Percentage discount cannot exceed 100% (10000 basis points)', [
      { field: 'value', message: 'Maximum value is 10000 for PERCENTAGE type' }
    ]);
  }
  
  const discountCode = await createDiscountCode(organizationId, data);
  
  logger.info('Discount code created', {
    organizationId,
    discountCodeId: discountCode.id,
    code: discountCode.code,
    type: discountCode.type,
    value: discountCode.value,
    userId,
  });
  
  return discountCode;
}

/**
 * Update discount code
 * @param {string} organizationId - Organization ID
 * @param {string} discountCodeId - Discount code ID
 * @param {Object} data - Update data
 * @param {string} userId - User ID updating discount code
 * @returns {Promise<Object>} Updated discount code
 */
export async function updateDiscountCodeService(organizationId, discountCodeId, data, userId) {
  // Validate percentage value if changing
  if (data.type === 'PERCENTAGE' && data.value > 10000) {
    throw new ValidationError('Percentage discount cannot exceed 100% (10000 basis points)', [
      { field: 'value', message: 'Maximum value is 10000 for PERCENTAGE type' }
    ]);
  }
  
  const discountCode = await updateDiscountCode(organizationId, discountCodeId, data);
  
  logger.info('Discount code updated', {
    organizationId,
    discountCodeId,
    userId,
    updates: Object.keys(data),
  });
  
  return discountCode;
}

/**
 * Delete discount code (soft delete)
 * @param {string} organizationId - Organization ID
 * @param {string} discountCodeId - Discount code ID
 * @param {string} userId - User ID deleting discount code
 * @returns {Promise<boolean>} Success status
 */
export async function deleteDiscountCodeService(organizationId, discountCodeId, userId) {
  await deleteDiscountCode(organizationId, discountCodeId);
  
  logger.info('Discount code deleted', {
    organizationId,
    discountCodeId,
    userId,
  });
  
  return true;
}

/**
 * Validate discount code for use in subscription
 * @param {string} organizationId - Organization ID
 * @param {string} code - Discount code
 * @returns {Promise<Object>} Validation result with discount info
 */
export async function validateDiscountCodeForUse(organizationId, code) {
  const result = await validateDiscountCode(organizationId, code);
  
  if (!result.valid) {
    throw new ValidationError(result.error);
  }
  
  // Calculate discount amount for a given amount
  const calculateDiscount = (amountCents) => {
    if (result.discountCode.type === 'PERCENTAGE') {
      // Percentage discount (basis points)
      return Math.floor((amountCents * result.discountCode.value) / 10000);
    } else {
      // Fixed amount discount
      return Math.min(result.discountCode.value, amountCents);
    }
  };
  
  return {
    discountCode: result.discountCode,
    calculateDiscount,
  };
}

/**
 * Apply discount code to subscription (called by subscriptions module)
 * @param {string} organizationId - Organization ID
 * @param {string} code - Discount code
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} tx - Prisma transaction client
 * @returns {Promise<Object>} Applied discount
 */
export async function applyDiscountCodeToSubscription(organizationId, code, subscriptionId, tx) {
  // Validate discount code
  const validation = await validateDiscountCode(organizationId, code);
  
  if (!validation.valid) {
    throw new ValidationError(validation.error);
  }
  
  const discountCode = validation.discountCode;
  
  // Check if discount already applied to this subscription
  const existing = await tx.subscriptionDiscount.findFirst({
    where: {
      subscription_id: subscriptionId,
      discount_code_id: discountCode.id,
      is_active: true,
    },
  });
  
  if (existing) {
    throw new ValidationError('Discount code already applied to this subscription');
  }
  
  // Apply discount
  const subscriptionDiscount = await tx.subscriptionDiscount.create({
    data: {
      organization_id: organizationId,
      subscription_id: subscriptionId,
      discount_code_id: discountCode.id,
      applied_at: new Date(),
      is_active: true,
    },
    include: {
      discount_code: true,
    },
  });
  
  // Increment usage count
  await incrementDiscountCodeUsage(discountCode.id);
  
  logger.info('Discount code applied to subscription', {
    organizationId,
    discountCodeId: discountCode.id,
    subscriptionId,
  });
  
  return subscriptionDiscount;
}

/**
 * Remove discount code from subscription
 * @param {string} organizationId - Organization ID
 * @param {string} subscriptionId - Subscription ID
 * @param {string} discountCodeId - Discount code ID
 * @param {Object} tx - Prisma transaction client
 * @returns {Promise<boolean>} Success status
 */
export async function removeDiscountCodeFromSubscription(organizationId, subscriptionId, discountCodeId, tx) {
  const subscriptionDiscount = await tx.subscriptionDiscount.findFirst({
    where: {
      organization_id: organizationId,
      subscription_id: subscriptionId,
      discount_code_id: discountCodeId,
      is_active: true,
    },
  });
  
  if (!subscriptionDiscount) {
    throw new ValidationError('Discount code not applied to this subscription');
  }
  
  await tx.subscriptionDiscount.update({
    where: { id: subscriptionDiscount.id },
    data: {
      is_active: false,
      expires_at: new Date(),
    },
  });
  
  logger.info('Discount code removed from subscription', {
    organizationId,
    discountCodeId,
    subscriptionId,
  });
  
  return true;
}

/**
 * Get discount code statistics
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Statistics
 */
export async function getDiscountCodeStats(organizationId) {
  const stats = await prisma.discountCode.aggregate({
    where: { organization_id: organizationId },
    _count: true,
    _sum: {
      uses_count: true,
    },
  });
  
  const activeCount = await prisma.discountCode.count({
    where: {
      organization_id: organizationId,
      is_active: true,
    },
  });
  
  const inactiveCount = await prisma.discountCode.count({
    where: {
      organization_id: organizationId,
      is_active: false,
    },
  });
  
  return {
    total: stats._count,
    active: activeCount,
    inactive: inactiveCount,
    total_uses: stats._sum.uses_count || 0,
  };
}

export default {
  getDiscountCode,
  getDiscountCodeByCodeService,
  listDiscountCodesService,
  createDiscountCodeService,
  updateDiscountCodeService,
  deleteDiscountCodeService,
  validateDiscountCodeForUse,
  applyDiscountCodeToSubscription,
  removeDiscountCodeFromSubscription,
  getDiscountCodeStats,
};