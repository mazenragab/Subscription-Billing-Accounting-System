import Joi from 'joi';

/**
 * Joi validation schemas for accounting endpoints
 */

export const recognizeRevenueSchema = Joi.object({
  period_month: Joi.date().iso().required(),
});

export default {
  recognizeRevenueSchema,
};
