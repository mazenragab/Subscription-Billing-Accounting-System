import Joi from 'joi';

/**
 * Joi validation schemas for billing automation endpoints
 */

export const runMonthlyInvoicesSchema = Joi.object({
  as_of_date: Joi.date().iso().optional(),
  limit: Joi.number().integer().min(1).max(500).default(100),
});

export default {
  runMonthlyInvoicesSchema,
};
