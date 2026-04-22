import Joi from 'joi';

/**
 * Joi validation schemas for plans module
 */

// Create plan schema
export const createPlanSchema = Joi.object({
  name: Joi.string().required().max(100),
  description: Joi.string().optional(),
  amount_cents: Joi.number().integer().min(0).required(),
  currency: Joi.string().length(3).uppercase().default('USD'),
  interval: Joi.string().valid('MONTHLY', 'QUARTERLY', 'ANNUAL').required(),
  trial_days: Joi.number().integer().min(0).default(0),
  is_active: Joi.boolean().default(true),
  is_public: Joi.boolean().default(true),
  sort_order: Joi.number().integer().min(0).default(0),
});

// Update plan schema
export const updatePlanSchema = Joi.object({
  name: Joi.string().max(100).optional(),
  description: Joi.string().optional(),
  amount_cents: Joi.number().integer().min(0).optional(),
  currency: Joi.string().length(3).uppercase().optional(),
  interval: Joi.string().valid('MONTHLY', 'QUARTERLY', 'ANNUAL').optional(),
  trial_days: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
  is_public: Joi.boolean().optional(),
  sort_order: Joi.number().integer().min(0).optional(),
});

// Create plan feature schema
export const createPlanFeatureSchema = Joi.object({
  feature_key: Joi.string().required().max(100),
  feature_value: Joi.string().required().max(255),
});

// List plans query schema
export const listPlansSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  cursor: Joi.string().optional(),
  is_active: Joi.boolean().optional(),
  is_public: Joi.boolean().optional(),
  interval: Joi.string().valid('MONTHLY', 'QUARTERLY', 'ANNUAL').optional(),
  search: Joi.string().max(100).optional(),
});

export default {
  createPlanSchema,
  updatePlanSchema,
  createPlanFeatureSchema,
  listPlansSchema,
};