import Joi from 'joi';

/**
 * Joi validation schemas for reports module
 */

// Income statement schema
export const incomeStatementSchema = Joi.object({
  from_date: Joi.date().iso().required(),
  to_date: Joi.date().iso().greater(Joi.ref('from_date')).required(),
});

// Trial balance schema
export const trialBalanceSchema = Joi.object({
  from_date: Joi.date().iso().required(),
  to_date: Joi.date().iso().greater(Joi.ref('from_date')).required(),
});

// Balance sheet schema
export const balanceSheetSchema = Joi.object({
  as_of_date: Joi.date().iso().default(Date.now),
});

// AR Aging schema
export const arAgingSchema = Joi.object({
  as_of_date: Joi.date().iso().default(Date.now),
});

// Deferred revenue waterfall schema
export const deferredRevenueWaterfallSchema = Joi.object({
  from_date: Joi.date().iso().required(),
  to_date: Joi.date().iso().greater(Joi.ref('from_date')).required(),
});

// MRR report schema
export const mrrReportSchema = Joi.object({
  as_of_date: Joi.date().iso().default(Date.now),
});

// Churn report schema
export const churnReportSchema = Joi.object({
  from_date: Joi.date().iso().required(),
  to_date: Joi.date().iso().greater(Joi.ref('from_date')).required(),
});

// Manual revenue recognition run schema
export const runRevenueRecognitionSchema = Joi.object({
  period_month: Joi.date().iso().optional(),
});

export default {
  trialBalanceSchema,
  incomeStatementSchema,
  balanceSheetSchema,
  arAgingSchema,
  deferredRevenueWaterfallSchema,
  mrrReportSchema,
  churnReportSchema,
  runRevenueRecognitionSchema,
};
