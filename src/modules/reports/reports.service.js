import logger from '../../shared/utils/logger.js';
import Money from '../../shared/utils/money.js';
import {
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
  getARAging,
  getDeferredRevenueWaterfall,
  getMRR,
  getChurnReport,
} from './reports.repository.js';

/**
 * Reports Service
 * Handles business logic for financial reports
 */

/**
 * Get trial balance
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Trial balance
 */
export async function getTrialBalanceReport(organizationId, query) {
  const { from_date, to_date } = query;
  
  const fromDate = new Date(from_date);
  const toDate = new Date(to_date);
  toDate.setHours(23, 59, 59, 999);
  
  const results = await getTrialBalance(organizationId, fromDate, toDate);
  
  // Calculate totals
  let totalDebits = 0;
  let totalCredits = 0;
  
  const formattedResults = results.map(row => {
    const balance = Number(row.net_balance_cents);
    const isDebitBalance = row.normal_balance === 'DEBIT';
    
    let debitCents = 0;
    let creditCents = 0;
    
    if (balance > 0) {
      if (isDebitBalance) {
        debitCents = balance;
        totalDebits += balance;
      } else {
        creditCents = balance;
        totalCredits += balance;
      }
    } else if (balance < 0) {
      if (isDebitBalance) {
        creditCents = Math.abs(balance);
        totalCredits += Math.abs(balance);
      } else {
        debitCents = Math.abs(balance);
        totalDebits += Math.abs(balance);
      }
    }
    
    return {
      code: row.code,
      name: row.name,
      type: row.type,
      normal_balance: row.normal_balance,
      debit_cents: debitCents,
      credit_cents: creditCents,
      balance_cents: balance,
    };
  });
  
  logger.info('Trial balance generated', {
    organizationId,
    fromDate,
    toDate,
    totalDebits,
    totalCredits,
  });
  
  return {
    accounts: formattedResults,
    totals: {
      total_debits_cents: totalDebits,
      total_credits_cents: totalCredits,
      is_balanced: totalDebits === totalCredits,
    },
    period: {
      from_date: fromDate,
      to_date: toDate,
    },
  };
}

/**
 * Get income statement
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Income statement
 */
export async function getIncomeStatementReport(organizationId, query) {
  const { from_date, to_date } = query;
  
  const fromDate = new Date(from_date);
  const toDate = new Date(to_date);
  toDate.setHours(23, 59, 59, 999);
  
  const result = await getIncomeStatement(organizationId, fromDate, toDate);
  
  logger.info('Income statement generated', {
    organizationId,
    fromDate,
    toDate,
    totalRevenue: result.total_revenue_cents,
    netIncome: result.net_income_cents,
  });
  
  return result;
}

/**
 * Get balance sheet
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Balance sheet
 */
export async function getBalanceSheetReport(organizationId, query) {
  const { as_of_date } = query;
  
  const asOfDate = new Date(as_of_date);
  asOfDate.setHours(23, 59, 59, 999);
  
  const result = await getBalanceSheet(organizationId, asOfDate);
  
  logger.info('Balance sheet generated', {
    organizationId,
    asOfDate,
    totalAssets: result.total_assets_cents,
    totalLiabilities: result.total_liabilities_cents,
    totalEquity: result.total_equity_cents,
    equationBalanced: result.equation_balanced,
  });
  
  return result;
}

/**
 * Get AR aging report
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} AR aging report
 */
export async function getARAgingReport(organizationId, query) {
  const { as_of_date } = query;
  
  const asOfDate = new Date(as_of_date);
  asOfDate.setHours(23, 59, 59, 999);
  
  const result = await getARAging(organizationId, asOfDate);
  
  logger.info('AR aging report generated', {
    organizationId,
    asOfDate,
    totalOutstanding: result.total_outstanding_cents,
  });
  
  return result;
}

/**
 * Get deferred revenue waterfall
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Deferred revenue waterfall
 */
export async function getDeferredRevenueWaterfallReport(organizationId, query) {
  const { from_date, to_date } = query;
  
  const fromDate = new Date(from_date);
  const toDate = new Date(to_date);
  toDate.setHours(23, 59, 59, 999);
  
  const results = await getDeferredRevenueWaterfall(organizationId, fromDate, toDate);
  
  const totalPending = results.reduce((sum, r) => sum + Number(r.pending_cents), 0);
  
  logger.info('Deferred revenue waterfall generated', {
    organizationId,
    fromDate,
    toDate,
    totalPending,
  });
  
  return {
    waterfall: results,
    total_pending_cents: totalPending,
    period: {
      from_date: fromDate,
      to_date: toDate,
    },
  };
}

/**
 * Get MRR report
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} MRR report
 */
export async function getMRRReport(organizationId, query) {
  const { as_of_date } = query;
  
  const asOfDate = new Date(as_of_date);
  asOfDate.setHours(23, 59, 59, 999);
  
  const result = await getMRR(organizationId, asOfDate);
  
  logger.info('MRR report generated', {
    organizationId,
    asOfDate,
    totalMRR: result.total_mrr_cents,
    activeSubscriptions: result.total_active_subscriptions,
  });
  
  return result;
}

/**
 * Get churn report
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Churn report
 */
export async function getChurnReportService(organizationId, query) {
  const { from_date, to_date } = query;
  
  const fromDate = new Date(from_date);
  const toDate = new Date(to_date);
  toDate.setHours(23, 59, 59, 999);
  
  const result = await getChurnReport(organizationId, fromDate, toDate);
  
  logger.info('Churn report generated', {
    organizationId,
    fromDate,
    toDate,
    customerChurnRate: result.churn_rates.customer_churn_rate_percent,
    revenueChurnRate: result.churn_rates.revenue_churn_rate_percent,
  });
  
  return result;
}

export default {
  getTrialBalanceReport,
  getIncomeStatementReport,
  getBalanceSheetReport,
  getARAgingReport,
  getDeferredRevenueWaterfallReport,
  getMRRReport,
  getChurnReportService,
};