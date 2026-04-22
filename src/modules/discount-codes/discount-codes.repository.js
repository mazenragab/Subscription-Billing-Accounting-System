import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../shared/errors/index.js';

/**
 * Discount Codes Repository
 * Handles database operations for discount codes
 */

/**
 * Get discount code by ID with tenant isolation
 * @param {string} organizationId - Organization ID
 * @param {string} discountCodeId - Discount code ID
 * @returns {Promise<Object>} Discount code
 */
export async function getDiscountCodeById(organizationId, discountCodeId) {
  const discountCode = await prisma.discountCode.findFirst({
    where: {
      id: discountCodeId,
      organization_id: organizationId,
    },
    include: {
      _count: {
        select: {
          subscription_discounts: true,
        },
      },
    },
  });
  
  if (!discountCode) {
    throw new NotFoundError('Discount code');
  }
  
  return discountCode;
}

/**
 * Get discount code by code with tenant isolation
 * @param {string} organizationId - Organization ID
 * @param {string} code - Discount code
 * @returns {Promise<Object|null>} Discount code or null
 */
export async function getDiscountCodeByCode(organizationId, code) {
  return await prisma.discountCode.findFirst({
    where: {
      organization_id: organizationId,
      code: code.toUpperCase(),
    },
    include: {
      _count: {
        select: {
          subscription_discounts: true,
        },
      },
    },
  });
}

/**
 * List discount codes with pagination and filters
 * @param {string} organizationId - Organization ID
 * @param {Object} filters - Filters (is_active, type)
 * @param {Object} pagination - Pagination params
 * @returns {Promise<Object>} Discount codes with pagination
 */
export async function listDiscountCodes(organizationId, filters = {}, pagination = {}) {
  const { is_active, type } = filters;
  const { limit = 20, cursor = null } = pagination;
  
  const where = {
    organization_id: organizationId,
  };
  
  if (is_active !== undefined) {
    where.is_active = is_active;
  }
  
  if (type) {
    where.type = type;
  }
  
  if (cursor) {
    where.id = { gt: cursor };
  }
  
  const discountCodes = await prisma.discountCode.findMany({
    where,
    include: {
      _count: {
        select: {
          subscription_discounts: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
    take: limit + 1,
  });
  
  const hasNextPage = discountCodes.length > limit;
  const data = hasNextPage ? discountCodes.slice(0, limit) : discountCodes;
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
 * Create discount code
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Discount code data
 * @returns {Promise<Object>} Created discount code
 */
export async function createDiscountCode(organizationId, data) {
  // Check for duplicate code
  const existing = await prisma.discountCode.findFirst({
    where: {
      organization_id: organizationId,
      code: data.code.toUpperCase(),
    },
  });
  
  if (existing) {
    throw new ConflictError(`Discount code "${data.code}" already exists`);
  }
  
  return await prisma.discountCode.create({
    data: {
      organization_id: organizationId,
      code: data.code.toUpperCase(),
      type: data.type,
      value: data.value,
      max_uses: data.max_uses,
      valid_from: data.valid_from,
      valid_until: data.valid_until,
      is_active: data.is_active !== undefined ? data.is_active : true,
    },
  });
}

/**
 * Update discount code
 * @param {string} organizationId - Organization ID
 * @param {string} discountCodeId - Discount code ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated discount code
 */
export async function updateDiscountCode(organizationId, discountCodeId, data) {
  await getDiscountCodeById(organizationId, discountCodeId);
  
  // Check for duplicate code if changing
  if (data.code) {
    const existing = await prisma.discountCode.findFirst({
      where: {
        organization_id: organizationId,
        code: data.code.toUpperCase(),
        id: { not: discountCodeId },
      },
    });
    
    if (existing) {
      throw new ConflictError(`Discount code "${data.code}" already exists`);
    }
  }
  
  return await prisma.discountCode.update({
    where: { id: discountCodeId },
    data: {
      ...data,
      code: data.code ? data.code.toUpperCase() : undefined,
    },
  });
}

/**
 * Delete discount code (soft delete by setting is_active = false)
 * @param {string} organizationId - Organization ID
 * @param {string} discountCodeId - Discount code ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteDiscountCode(organizationId, discountCodeId) {
  const discountCode = await getDiscountCodeById(organizationId, discountCodeId);
  
  // Check if code is in use
  const usageCount = await prisma.subscriptionDiscount.count({
    where: {
      discount_code_id: discountCodeId,
      is_active: true,
    },
  });
  
  if (usageCount > 0) {
    throw new ConflictError('Cannot delete discount code that is currently in use. Deactivate it instead.');
  }
  
  await prisma.discountCode.update({
    where: { id: discountCodeId },
    data: { is_active: false },
  });
  
  return true;
}

/**
 * Increment discount code usage count
 * @param {string} discountCodeId - Discount code ID
 * @returns {Promise<Object>} Updated discount code
 */
export async function incrementDiscountCodeUsage(discountCodeId) {
  return await prisma.discountCode.update({
    where: { id: discountCodeId },
    data: { uses_count: { increment: 1 } },
  });
}

/**
 * Validate discount code for use
 * @param {string} organizationId - Organization ID
 * @param {string} code - Discount code
 * @returns {Promise<Object>} Validation result
 */
export async function validateDiscountCode(organizationId, code) {
  const discountCode = await getDiscountCodeByCode(organizationId, code);
  
  if (!discountCode) {
    return { valid: false, error: 'Discount code not found' };
  }
  
  if (!discountCode.is_active) {
    return { valid: false, error: 'Discount code is inactive' };
  }
  
  const now = new Date();
  
  if (discountCode.valid_from && new Date(discountCode.valid_from) > now) {
    return { valid: false, error: 'Discount code is not yet valid' };
  }
  
  if (discountCode.valid_until && new Date(discountCode.valid_until) < now) {
    return { valid: false, error: 'Discount code has expired' };
  }
  
  if (discountCode.max_uses && discountCode.uses_count >= discountCode.max_uses) {
    return { valid: false, error: 'Discount code has reached maximum uses' };
  }
  
  return { valid: true, discountCode };
}

export default {
  getDiscountCodeById,
  getDiscountCodeByCode,
  listDiscountCodes,
  createDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
  incrementDiscountCodeUsage,
  validateDiscountCode,
};