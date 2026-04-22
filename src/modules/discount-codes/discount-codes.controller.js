import {
  getDiscountCode,
  listDiscountCodesService,
  createDiscountCodeService,
  updateDiscountCodeService,
  deleteDiscountCodeService,
  validateDiscountCodeForUse,
  getDiscountCodeStats,
} from './discount-codes.service.js';

/**
 * Discount Codes Controller
 * Handles HTTP request/response for discount code management
 */

/**
 * List discount codes
 */
export async function listDiscountCodes(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await listDiscountCodesService(organizationId, query);
    
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
 * Get discount code by ID
 */
export async function getDiscountCodeById(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    
    const result = await getDiscountCode(organizationId, id);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Validate discount code by code
 */
export async function validateDiscountCode(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { code } = req.params;
    
    const result = await validateDiscountCodeForUse(organizationId, code);
    
    res.status(200).json({
      success: true,
      data: {
        valid: true,
        discount_code: {
          id: result.discountCode.id,
          code: result.discountCode.code,
          type: result.discountCode.type,
          value: result.discountCode.value,
        },
      },
    });
  } catch (error) {
    res.status(200).json({
      success: true,
      data: {
        valid: false,
        error: error.message,
      },
    });
  }
}

/**
 * Create discount code
 */
export async function createDiscountCode(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await createDiscountCodeService(organizationId, data, userId);
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update discount code
 */
export async function updateDiscountCode(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await updateDiscountCodeService(organizationId, id, data, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete discount code (soft delete)
 */
export async function deleteDiscountCode(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    
    await deleteDiscountCodeService(organizationId, id, userId);
    
    res.status(200).json({
      success: true,
      message: 'Discount code deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get discount code statistics
 */
export async function getDiscountCodeStatsController(req, res, next) {
  try {
    const organizationId = req.tenantId;
    
    const result = await getDiscountCodeStats(organizationId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  listDiscountCodes,
  getDiscountCodeById,
  validateDiscountCode,
  createDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
  getDiscountCodeStatsController,
};