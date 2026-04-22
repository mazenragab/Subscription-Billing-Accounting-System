import Joi from 'joi';

/**
 * Joi validation schemas for discount codes module
 */

// Create discount code schema
export const createDiscountCodeSchema = Joi.object({
  code: Joi.string().required().max(50).uppercase(),
  type: Joi.string().valid('PERCENTAGE', 'FIXED_AMOUNT').required(),
  value: Joi.number().integer().positive().required(),
  max_uses: Joi.number().integer().min(1).optional(),
  valid_from: Joi.date().iso().optional(),
  valid_until: Joi.date().iso().greater(Joi.ref('valid_from')).optional(),
  is_active: Joi.boolean().default(true),
});

// Update discount code schema
export const updateDiscountCodeSchema = Joi.object({
  code: Joi.string().max(50).uppercase().optional(),
  type: Joi.string().valid('PERCENTAGE', 'FIXED_AMOUNT').optional(),
  value: Joi.number().integer().positive().optional(),
  max_uses: Joi.number().integer().min(1).optional(),
  valid_from: Joi.date().iso().optional(),
  valid_until: Joi.date().iso().optional(),
  is_active: Joi.boolean().optional(),
});

// List discount codes query schema
export const listDiscountCodesSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  cursor: Joi.string().optional(),
  is_active: Joi.boolean().optional(),
  type: Joi.string().valid('PERCENTAGE', 'FIXED_AMOUNT').optional(),
});

export default {
  createDiscountCodeSchema,
  updateDiscountCodeSchema,
  listDiscountCodesSchema,
};