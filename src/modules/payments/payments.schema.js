import Joi from 'joi';

/**
 * Joi validation schemas for payments module
 */

// Record payment schema (also used in invoices, but defined here for consistency)
export const recordPaymentSchema = Joi.object({
  amount_cents: Joi.number().integer().positive().required(),
  method: Joi.string().valid('BANK_TRANSFER', 'CREDIT_CARD', 'CASH', 'CHECK', 'OTHER').required(),
  reference: Joi.string().max(100).optional(),
  idempotency_key: Joi.string().max(100).required(),
  paid_at: Joi.date().iso().optional(),
});

// Refund payment schema
export const refundPaymentSchema = Joi.object({
  amount_cents: Joi.number().integer().positive().required(),
  reason: Joi.string().max(500).optional(),
  idempotency_key: Joi.string().max(100).required(),
});

// List payments query schema
export const listPaymentsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  cursor: Joi.string().optional(),
  customer_id: Joi.string().uuid().optional(),
  invoice_id: Joi.string().uuid().optional(),
  method: Joi.string().valid('BANK_TRANSFER', 'CREDIT_CARD', 'CASH', 'CHECK', 'OTHER').optional(),
  from_date: Joi.date().iso().optional(),
  to_date: Joi.date().iso().optional(),
});

// Payment method schema (for saved payment methods)
export const savePaymentMethodSchema = Joi.object({
  type: Joi.string().valid('CREDIT_CARD', 'BANK_ACCOUNT').required(),
  last4: Joi.string().pattern(/^\d{4}$/).required(),
  expiry_month: Joi.number().integer().min(1).max(12).when('type', {
    is: 'CREDIT_CARD',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  expiry_year: Joi.number().integer().min(new Date().getFullYear()).max(new Date().getFullYear() + 10).when('type', {
    is: 'CREDIT_CARD',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  holder_name: Joi.string().max(255).required(),
  is_default: Joi.boolean().default(false),
});

export default {
  recordPaymentSchema,
  refundPaymentSchema,
  listPaymentsSchema,
  savePaymentMethodSchema,
};