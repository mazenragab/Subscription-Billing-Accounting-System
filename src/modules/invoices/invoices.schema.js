import Joi from 'joi';

/**
 * Joi validation schemas for invoices module
 */

// Create invoice schema (DRAFT)
export const createInvoiceSchema = Joi.object({
  customer_id: Joi.string().uuid().required(),
  subscription_id: Joi.string().uuid().required(),
  period_start: Joi.date().iso().required(),
  period_end: Joi.date().iso().greater(Joi.ref('period_start')).required(),
  line_items: Joi.array().items(
    Joi.object({
      description: Joi.string().required().max(500),
      quantity: Joi.number().integer().min(1).default(1),
      unit_amount_cents: Joi.number().integer().min(0).required(),
      amount_cents: Joi.number().integer().min(0).required(),
      plan_id: Joi.string().uuid().optional(),
      plan_name: Joi.string().max(100).optional(),
      period_start: Joi.date().iso().optional(),
      period_end: Joi.date().iso().optional(),
    })
  ).min(1).required(),
  notes: Joi.string().optional(),
});

// Issue invoice schema
export const issueInvoiceSchema = Joi.object({
  issued_at: Joi.date().iso().optional(),
  due_at: Joi.date().iso().optional(),
});

// Record payment schema
export const recordPaymentSchema = Joi.object({
  amount_cents: Joi.number().integer().positive().required(),
  method: Joi.string().valid('BANK_TRANSFER', 'CREDIT_CARD', 'CASH', 'CHECK', 'OTHER').required(),
  reference: Joi.string().max(100).optional(),
  idempotency_key: Joi.string().max(100).required(),
  paid_at: Joi.date().iso().optional(),
});

// List invoices query schema
export const listInvoicesSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  cursor: Joi.string().optional(),
  status: Joi.string().valid('DRAFT', 'ISSUED', 'PAID', 'VOID', 'UNCOLLECTIBLE').optional(),
  customer_id: Joi.string().uuid().optional(),
  subscription_id: Joi.string().uuid().optional(),
  from_date: Joi.date().iso().optional(),
  to_date: Joi.date().iso().optional(),
});

export default {
  createInvoiceSchema,
  issueInvoiceSchema,
  recordPaymentSchema,
  listInvoicesSchema,
};