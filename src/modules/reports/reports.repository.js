import { prisma } from '../../config/database.js';

/**
 * Reports Repository
 * Handles database queries for financial reports
 */

/**
 * Get trial balance for a period
 * @param {string} organizationId - Organization ID
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Promise<Array>} Trial balance
 */
export async function getTrialBalance(organizationId, fromDate, toDate) {
  const results = await prisma.$queryRaw`
    SELECT 
      coa.code,
      coa.name,
      coa.type,
      coa.normal_balance,
      COALESCE(SUM(
        CASE
          WHEN je.id IS NULL THEN 0
          WHEN jel.type = 'DEBIT' THEN jel.amount_cents
          WHEN jel.type = 'CREDIT' THEN -jel.amount_cents
          ELSE 0
        END
      ), 0) AS net_balance_cents
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
      AND jel.organization_id = ${organizationId}
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
      AND je.status = 'POSTED'
      AND je.posted_at BETWEEN ${fromDate} AND ${toDate}
    WHERE coa.organization_id = ${organizationId}
      AND coa.is_active = true
    GROUP BY coa.id, coa.code, coa.name, coa.type, coa.normal_balance
    ORDER BY coa.code
  `;
  
  return results;
}

/**
 * Get income statement data
 * @param {string} organizationId - Organization ID
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Promise<Object>} Income statement
 */
export async function getIncomeStatement(organizationId, fromDate, toDate) {
  // Get revenue accounts
  const revenue = await prisma.$queryRaw`
    SELECT 
      coa.code,
      coa.name,
      COALESCE(SUM(
        CASE
          WHEN je.id IS NULL THEN 0
          WHEN jel.type = 'CREDIT' THEN jel.amount_cents
          WHEN jel.type = 'DEBIT' THEN -jel.amount_cents
          ELSE 0
        END
      ), 0) AS amount_cents
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
      AND jel.organization_id = ${organizationId}
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
      AND je.status = 'POSTED'
      AND je.posted_at BETWEEN ${fromDate} AND ${toDate}
    WHERE coa.organization_id = ${organizationId}
      AND coa.type = 'REVENUE'
      AND coa.is_active = true
    GROUP BY coa.id, coa.code, coa.name
    ORDER BY coa.code
  `;
  
  // Get expense accounts
  const expenses = await prisma.$queryRaw`
    SELECT 
      coa.code,
      coa.name,
      COALESCE(SUM(
        CASE
          WHEN je.id IS NULL THEN 0
          WHEN jel.type = 'DEBIT' THEN jel.amount_cents
          WHEN jel.type = 'CREDIT' THEN -jel.amount_cents
          ELSE 0
        END
      ), 0) AS amount_cents
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
      AND jel.organization_id = ${organizationId}
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
      AND je.status = 'POSTED'
      AND je.posted_at BETWEEN ${fromDate} AND ${toDate}
    WHERE coa.organization_id = ${organizationId}
      AND coa.type = 'EXPENSE'
      AND coa.is_active = true
    GROUP BY coa.id, coa.code, coa.name
    ORDER BY coa.code
  `;
  
  // Calculate totals
  const totalRevenue = revenue.reduce((sum, r) => sum + Number(r.amount_cents), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount_cents), 0);
  const netIncome = totalRevenue - totalExpenses;
  
  return {
    revenue,
    expenses,
    total_revenue_cents: totalRevenue,
    total_expenses_cents: totalExpenses,
    net_income_cents: netIncome,
    period: {
      from_date: fromDate,
      to_date: toDate,
    },
  };
}

/**
 * Get balance sheet as of a date
 * @param {string} organizationId - Organization ID
 * @param {Date} asOfDate - Date to get balance sheet
 * @returns {Promise<Object>} Balance sheet
 */
export async function getBalanceSheet(organizationId, asOfDate) {
  const accounts = await prisma.$queryRaw`
    WITH account_balances AS (
      SELECT
        coa.id,
        coa.code,
        coa.name,
        coa.type,
        coa.normal_balance,
        COALESCE(SUM(
          CASE
            WHEN je.id IS NULL THEN 0
            WHEN jel.type = 'DEBIT' THEN jel.amount_cents
            WHEN jel.type = 'CREDIT' THEN -jel.amount_cents
            ELSE 0
          END
        ), 0) AS net_debit_cents
      FROM chart_of_accounts coa
      LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
        AND jel.organization_id = ${organizationId}
      LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
        AND je.status = 'POSTED'
        AND je.posted_at <= ${asOfDate}
      WHERE coa.organization_id = ${organizationId}
        AND coa.is_active = true
      GROUP BY coa.id, coa.code, coa.name, coa.type, coa.normal_balance
    )
    SELECT
      code,
      name,
      type,
      CASE normal_balance
        WHEN 'DEBIT'  THEN  net_debit_cents
        WHEN 'CREDIT' THEN -net_debit_cents
      END AS balance_cents
    FROM account_balances
    ORDER BY code
  `;
  
  // Group by account type
  const assets = accounts.filter(a => a.type === 'ASSET');
  const liabilities = accounts.filter(a => a.type === 'LIABILITY');
  const equityAccounts = accounts.filter(a => a.type === 'EQUITY');
  const revenueAccounts = accounts.filter(a => a.type === 'REVENUE');
  const expenseAccounts = accounts.filter(a => a.type === 'EXPENSE');

  // Treat cumulative net income as retained earnings to keep the accounting equation complete.
  const retainedEarnings = revenueAccounts.reduce((sum, r) => sum + Number(r.balance_cents), 0)
    - expenseAccounts.reduce((sum, e) => sum + Number(e.balance_cents), 0);

  const equity = [
    ...equityAccounts,
    {
      code: 'RETAINED_EARNINGS',
      name: 'Retained Earnings',
      type: 'EQUITY',
      balance_cents: retainedEarnings,
      is_system_calculated: true,
    },
  ];
  
  const totalAssets = assets.reduce((sum, a) => sum + Number(a.balance_cents), 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + Number(l.balance_cents), 0);
  const totalEquity = equity.reduce((sum, e) => sum + Number(e.balance_cents), 0);
  
  return {
    assets,
    liabilities,
    equity,
    total_assets_cents: totalAssets,
    total_liabilities_cents: totalLiabilities,
    total_equity_cents: totalEquity,
    as_of_date: asOfDate,
    equation_balanced: totalAssets === (totalLiabilities + totalEquity),
  };
}

/**
 * Get AR aging report
 * @param {string} organizationId - Organization ID
 * @param {Date} asOfDate - Date to calculate aging
 * @returns {Promise<Array>} AR aging buckets
 */
export async function getARAging(organizationId, asOfDate) {
  const aging = await prisma.$queryRaw`
    SELECT 
      c.id as customer_id,
      c.name as customer_name,
      c.email as customer_email,
      i.id as invoice_id,
      i.invoice_number,
      (i.total_cents - COALESCE(p.total_paid_cents, 0)) AS outstanding_cents,
      i.issued_at,
      i.due_at,
      EXTRACT(DAY FROM (${asOfDate} - i.due_at)) as days_overdue,
      CASE 
        WHEN i.due_at >= ${asOfDate} THEN 0
        WHEN EXTRACT(DAY FROM (${asOfDate} - i.due_at)) <= 30 THEN 1
        WHEN EXTRACT(DAY FROM (${asOfDate} - i.due_at)) <= 60 THEN 2
        WHEN EXTRACT(DAY FROM (${asOfDate} - i.due_at)) <= 90 THEN 3
        ELSE 4
      END as bucket
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    LEFT JOIN (
      SELECT
        invoice_id,
        SUM(amount_cents) AS total_paid_cents
      FROM payments
      WHERE organization_id = ${organizationId}
      GROUP BY invoice_id
    ) p ON p.invoice_id = i.id
    WHERE i.organization_id = ${organizationId}
      AND i.status = 'ISSUED'
      AND i.due_at <= ${asOfDate}
      AND (i.total_cents - COALESCE(p.total_paid_cents, 0)) > 0
    ORDER BY c.name, i.due_at
  `;
  
  // Group by bucket
  const buckets = {
    current: { count: 0, amount_cents: 0, invoices: [] },
    days_1_30: { count: 0, amount_cents: 0, invoices: [] },
    days_31_60: { count: 0, amount_cents: 0, invoices: [] },
    days_61_90: { count: 0, amount_cents: 0, invoices: [] },
    days_90_plus: { count: 0, amount_cents: 0, invoices: [] },
  };
  
  for (const invoice of aging) {
    const bucketKey = getBucketKey(invoice.bucket);
    buckets[bucketKey].count++;
    buckets[bucketKey].amount_cents += Number(invoice.outstanding_cents);
    buckets[bucketKey].invoices.push(invoice);
  }
  
  const totalOutstanding = Object.values(buckets).reduce((sum, b) => sum + b.amount_cents, 0);
  
  return {
    buckets,
    total_outstanding_cents: totalOutstanding,
    as_of_date: asOfDate,
  };
}

function getBucketKey(bucket) {
  switch (bucket) {
    case 0: return 'current';
    case 1: return 'days_1_30';
    case 2: return 'days_31_60';
    case 3: return 'days_61_90';
    default: return 'days_90_plus';
  }
}

/**
 * Get deferred revenue waterfall
 * @param {string} organizationId - Organization ID
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Promise<Array>} Waterfall data
 */
export async function getDeferredRevenueWaterfall(organizationId, fromDate, toDate) {
  const waterfall = await prisma.$queryRaw`
    SELECT
      period_month,
      SUM(amount_cents) AS pending_cents,
      COUNT(*) AS invoice_count
    FROM revenue_recognition_schedules
    WHERE organization_id = ${organizationId}
      AND period_month BETWEEN ${fromDate} AND ${toDate}
      AND status = 'PENDING'
    GROUP BY period_month
    ORDER BY period_month
  `;
  
  return waterfall;
}

/**
 * Get MRR (Monthly Recurring Revenue) report
 * @param {string} organizationId - Organization ID
 * @param {Date} asOfDate - Date to calculate MRR
 * @returns {Promise<Object>} MRR report
 */
export async function getMRR(organizationId, asOfDate) {
  const mrr = await prisma.$queryRaw`
    SELECT
      p.interval,
      COUNT(s.id) AS subscription_count,
      SUM(p.amount_cents) AS mrr_cents,
      SUM(
        CASE p.interval
          WHEN 'QUARTERLY' THEN p.amount_cents / 3
          WHEN 'ANNUAL' THEN p.amount_cents / 12
          ELSE p.amount_cents
        END
      ) AS normalized_mrr_cents
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.organization_id = ${organizationId}
      AND s.status IN ('ACTIVE', 'TRIALING', 'PAST_DUE')
      AND s.current_period_start <= ${asOfDate}
      AND s.current_period_end >= ${asOfDate}
    GROUP BY p.interval
  `;
  
  const totalMRR = mrr.reduce((sum, m) => sum + Number(m.normalized_mrr_cents), 0);
  const totalSubscriptions = mrr.reduce((sum, m) => sum + Number(m.subscription_count), 0);
  
  return {
    by_interval: mrr,
    total_mrr_cents: totalMRR,
    total_active_subscriptions: totalSubscriptions,
    as_of_date: asOfDate,
  };
}

/**
 * Get churn report
 * @param {string} organizationId - Organization ID
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Promise<Object>} Churn report
 */
export async function getChurnReport(organizationId, fromDate, toDate) {
  // Get subscriptions that started during period
  const newSubscriptions = await prisma.subscription.count({
    where: {
      organization_id: organizationId,
      created_at: {
        gte: fromDate,
        lte: toDate,
      },
    },
  });
  
  // Get subscriptions that cancelled during period
  const cancelledSubscriptions = await prisma.subscription.count({
    where: {
      organization_id: organizationId,
      cancelled_at: {
        gte: fromDate,
        lte: toDate,
      },
    },
  });
  
  // Get subscriptions active at start of period
  const activeAtStart = await prisma.subscription.count({
    where: {
      organization_id: organizationId,
      status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
      created_at: { lt: fromDate },
      OR: [
        { cancelled_at: null },
        { cancelled_at: { gt: fromDate } },
      ],
    },
  });

  // Get subscriptions active at end of period
  const activeAtEnd = await prisma.subscription.count({
    where: {
      organization_id: organizationId,
      status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
      created_at: { lte: toDate },
      OR: [
        { cancelled_at: null },
        { cancelled_at: { gt: toDate } },
      ],
    },
  });
  
  // Get MRR at start of period
  const mrrAtStart = await getMRR(organizationId, fromDate);
  
  // Get MRR at end of period
  const mrrAtEnd = await getMRR(organizationId, toDate);
  
  // Calculate churn rates
  const customerChurnRate = activeAtStart > 0 
    ? (cancelledSubscriptions / activeAtStart) * 100 
    : 0;
  
  const revenueChurnRate = mrrAtStart.total_mrr_cents > 0
    ? ((mrrAtStart.total_mrr_cents - mrrAtEnd.total_mrr_cents) / mrrAtStart.total_mrr_cents) * 100
    : 0;
  
  return {
    period: { from_date: fromDate, to_date: toDate },
    metrics: {
      new_subscriptions: newSubscriptions,
      cancelled_subscriptions: cancelledSubscriptions,
      active_subscriptions_start: activeAtStart,
      active_subscriptions_end: activeAtEnd,
      net_subscription_change: newSubscriptions - cancelledSubscriptions,
    },
    churn_rates: {
      customer_churn_rate_percent: Math.round(customerChurnRate * 100) / 100,
      revenue_churn_rate_percent: Math.round(revenueChurnRate * 100) / 100,
    },
    mrr: {
      start_mrr_cents: mrrAtStart.total_mrr_cents,
      end_mrr_cents: mrrAtEnd.total_mrr_cents,
      net_mrr_change_cents: mrrAtEnd.total_mrr_cents - mrrAtStart.total_mrr_cents,
    },
  };
}

export default {
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
  getARAging,
  getDeferredRevenueWaterfall,
  getMRR,
  getChurnReport,
};
