import Joi from 'joi';

/**
 * Joi validation schemas for organizations module
 */

// Update organization schema
export const updateOrganizationSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  slug: Joi.string()
    .pattern(/^[a-z0-9-]+$/)
    .max(100)
    .optional(),
  status: Joi.string()
    .valid('ACTIVE', 'SUSPENDED', 'CANCELLED')
    .optional(),
});

// Update billing settings schema
export const updateBillingSettingsSchema = Joi.object({
  currency: Joi.string().length(3).uppercase().default('USD'),
  timezone: Joi.string().max(50).default('UTC'),
  invoice_prefix: Joi.string().max(10).default('INV'),
  payment_terms_days: Joi.number().integer().min(0).max(90).default(30),
  tax_rate_bps: Joi.number().integer().min(0).max(10000).default(0),
  dunning_enabled: Joi.boolean().default(true),
  dunning_retry_days: Joi.array().items(Joi.number().integer().min(1).max(30)).default([3, 7, 14]),
});

// Invite user schema
export const inviteUserSchema = Joi.object({
  email: Joi.string().email().required().max(255),
  role: Joi.string()
    .valid('ADMIN', 'BILLING_MANAGER', 'VIEWER')
    .required(),
});

// Update user role schema
export const updateUserRoleSchema = Joi.object({
  role: Joi.string()
    .valid('ADMIN', 'BILLING_MANAGER', 'VIEWER')
    .required(),
});

export default {
  updateOrganizationSchema,
  updateBillingSettingsSchema,
  inviteUserSchema,
  updateUserRoleSchema,
};