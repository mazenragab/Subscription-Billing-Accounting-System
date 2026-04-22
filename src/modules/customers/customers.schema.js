import Joi from 'joi';

/**
 * Joi validation schemas for customers module
 */

// Create customer schema
export const createCustomerSchema = Joi.object({
  external_id: Joi.string().max(100).optional(),
  name: Joi.string().required().max(255),
  email: Joi.string().email().required().max(255),
  phone: Joi.string().max(30).optional(),
  notes: Joi.string().optional(),
});

// Update customer schema
export const updateCustomerSchema = Joi.object({
  external_id: Joi.string().max(100).optional(),
  name: Joi.string().max(255).optional(),
  email: Joi.string().email().max(255).optional(),
  phone: Joi.string().max(30).optional(),
  status: Joi.string().valid('ACTIVE', 'SUSPENDED', 'CANCELLED').optional(),
  notes: Joi.string().optional(),
});

// Update billing info schema
export const updateBillingInfoSchema = Joi.object({
  billing_name: Joi.string().max(255).optional(),
  billing_email: Joi.string().email().max(255).optional(),
  address_line1: Joi.string().max(255).optional(),
  address_line2: Joi.string().max(255).optional(),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  postal_code: Joi.string().max(20).optional(),
  country_code: Joi.string().length(2).uppercase().optional(),
  tax_id: Joi.string().max(50).optional(),
});

// List customers query schema
export const listCustomersSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  cursor: Joi.string().optional(),
  status: Joi.string().valid('ACTIVE', 'SUSPENDED', 'CANCELLED').optional(),
  search: Joi.string().max(100).optional(),
});

export default {
  createCustomerSchema,
  updateCustomerSchema,
  updateBillingInfoSchema,
  listCustomersSchema,
};