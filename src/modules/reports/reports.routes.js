import express from 'express';
import {
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
  getARAging,
  getDeferredRevenueWaterfall,
  getMRR,
  getChurn,
} from './reports.controller.js';
import {
  incomeStatementSchema,
  balanceSheetSchema,
  arAgingSchema,
  deferredRevenueWaterfallSchema,
  mrrReportSchema,
  churnReportSchema,
} from './reports.schema.js';
import validateMiddleware from '../../middleware/validate.middleware.js';
import authMiddleware from '../../middleware/auth.middleware.js';
import tenantMiddleware from '../../middleware/tenant.middleware.js';

const router = express.Router();

// All report routes require auth and tenant context
router.use(authMiddleware, tenantMiddleware);

/**
 * @route GET /api/v1/reports/trial-balance
 * @desc Get trial balance for a period
 * @access Private
 */
router.get(
  '/trial-balance',
  validateMiddleware({ query: incomeStatementSchema }),
  getTrialBalance
);

/**
 * @route GET /api/v1/reports/income-statement
 * @desc Get income statement for a period
 * @access Private
 */
router.get(
  '/income-statement',
  validateMiddleware({ query: incomeStatementSchema }),
  getIncomeStatement
);

/**
 * @route GET /api/v1/reports/balance-sheet
 * @desc Get balance sheet as of a date
 * @access Private
 */
router.get(
  '/balance-sheet',
  validateMiddleware({ query: balanceSheetSchema }),
  getBalanceSheet
);

/**
 * @route GET /api/v1/reports/ar-aging
 * @desc Get accounts receivable aging report
 * @access Private
 */
router.get(
  '/ar-aging',
  validateMiddleware({ query: arAgingSchema }),
  getARAging
);

/**
 * @route GET /api/v1/reports/deferred-revenue-waterfall
 * @desc Get deferred revenue waterfall
 * @access Private
 */
router.get(
  '/deferred-revenue-waterfall',
  validateMiddleware({ query: deferredRevenueWaterfallSchema }),
  getDeferredRevenueWaterfall
);

/**
 * @route GET /api/v1/reports/mrr
 * @desc Get Monthly Recurring Revenue report
 * @access Private
 */
router.get(
  '/mrr',
  validateMiddleware({ query: mrrReportSchema }),
  getMRR
);

/**
 * @route GET /api/v1/reports/churn
 * @desc Get churn analysis report
 * @access Private
 */
router.get(
  '/churn',
  validateMiddleware({ query: churnReportSchema }),
  getChurn
);

export default router;