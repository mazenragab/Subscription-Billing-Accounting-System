import Joi from 'joi';

/**
 * Joi validation schemas for subscriptions module
 */

// Create subscription schema
export const createSubscriptionSchema = Joi.object({
  customer_id: Joi.string().uuid().required(),
  plan_id: Joi.string().uuid().required(),
  billing_anchor_day: Joi.number().integer().min(1).max(28).optional(),
  trial_days: Joi.number().integer().min(0).optional(),
});

// Cancel subscription schema
export const cancelSubscriptionSchema = Joi.object({
  immediate: Joi.boolean().default(false),
  cancellation_reason: Joi.string().max(500).optional(),
});

// Change plan schema (upgrade/downgrade)
export const changePlanSchema = Joi.object({
  new_plan_id: Joi.string().uuid().required(),
  immediate: Joi.boolean().default(false),
  proration_date: Joi.date().iso().optional(),
});

// Apply discount schema
export const applyDiscountSchema = Joi.object({
  discount_code: Joi.string().required().max(50),
});

// List subscriptions query schema
export const listSubscriptionsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  cursor: Joi.string().optional(),
  status: Joi.string().valid('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELLED', 'EXPIRED').optional(),
  customer_id: Joi.string().uuid().optional(),
  plan_id: Joi.string().uuid().optional(),
  search: Joi.string().max(100).optional(),
});

// Manual monthly invoicing simulation schema
export const runMonthlyInvoicingSchema = Joi.object({
  as_of_date: Joi.date().iso().optional(),
  limit: Joi.number().integer().min(1).max(500).default(100),
});

export default {
  createSubscriptionSchema,
  cancelSubscriptionSchema,
  changePlanSchema,
  applyDiscountSchema,
  listSubscriptionsSchema,
  runMonthlyInvoicingSchema,
};
