import { prisma } from '../config/database.js';
import logger from '../shared/utils/logger.js';
import { getPeriodMonth, getFirstDayOfMonth, addMonths, daysBetween } from '../shared/utils/date.js';
import Money from '../shared/utils/money.js';
import { AccountingError, ValidationError } from '../shared/errors/index.js';
import { createRecognitionJournalEntry } from './journal.service.js';
import { RECOGNITION_STATUS } from './accounting.constants.js';
import config from '../config/env.js';

const BATCH_SIZE = config.billing?.recognitionBatchSize || 100;

/**
 * Revenue Recognition Service
 * Handles month-end revenue recognition for deferred revenue
 */

/**
 * Create revenue recognition schedules for an invoice
 * Called when invoice is issued
 * 
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.invoiceId - Invoice ID
 * @param {string} params.subscriptionId - Subscription ID
 * @param {Date} params.periodStart - Invoice period start
 * @param {Date} params.periodEnd - Invoice period end
 * @param {number} params.totalCents - Total invoice amount in cents
 * @param {Object} params.tx - Prisma transaction client
 * @returns {Promise<Array>} Created recognition schedules
 */
export async function createRecognitionSchedules({
  organizationId,
  invoiceId,
  subscriptionId,
  periodStart,
  periodEnd,
  totalCents,
  tx,
}) {
  const months = getMonthsInRange(periodStart, periodEnd);
  const monthlyAmount = Money.divide(totalCents, months.length);
  const schedules = [];
  
  for (let i = 0; i < months.length; i++) {
    const periodMonth = months[i];
    let amount = monthlyAmount;
    
    // Handle remainder for last month
    if (i === months.length - 1) {
      const totalScheduled = monthlyAmount * (months.length - 1);
      amount = Money.subtract(totalCents, totalScheduled);
    }
    
    const schedule = await tx.revenueRecognitionSchedule.create({
      data: {
        organization_id: organizationId,
        invoice_id: invoiceId,
        subscription_id: subscriptionId,
        period_month: periodMonth,
        amount_cents: amount,
        status: RECOGNITION_STATUS.PENDING,
      },
    });
    
    schedules.push(schedule);
  }
  
  logger.info('Recognition schedules created', {
    organizationId,
    invoiceId,
    subscriptionId,
    scheduleCount: schedules.length,
    totalAmount: totalCents,
  });
  
  return schedules;
}

/**
 * Get months between two dates (inclusive)
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Date[]} Array of month start dates
 */
function getMonthsInRange(startDate, endDate) {
  const months = [];
  let current = getFirstDayOfMonth(startDate);
  const end = getFirstDayOfMonth(endDate);
  
  while (current <= end) {
    months.push(new Date(current));
    current = addMonths(current, 1);
  }
  
  return months;
}

/**
 * Process revenue recognition for a specific period
 * Idempotent - can be called multiple times safely
 * 
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {Date} params.periodMonth - Month to recognize (first day of month)
 * @param {string|null} params.createdById - User ID who triggered recognition
 * @returns {Promise<Object>} Recognition result
 */
export async function processRecognition({ organizationId, periodMonth, createdById = null }) {
  const result = {
    processed: 0,
    skipped: 0,
    errors: [],
    totalRecognizedCents: 0,
  };
  
  await prisma.$transaction(async (tx) => {
    // Get pending recognition schedules with SKIP LOCKED for concurrency
    const schedules = await getPendingSchedules(organizationId, periodMonth, tx);
    
    for (const schedule of schedules) {
      try {
        // Create journal entry for recognition
        const journalEntry = await createRecognitionJournalEntry({
          organizationId,
          recognitionId: schedule.id,
          amountCents: schedule.amount_cents,
          periodMonth,
          createdById,
          tx,
        });
        
        // Update schedule as recognized
        await tx.revenueRecognitionSchedule.update({
          where: { id: schedule.id },
          data: {
            status: RECOGNITION_STATUS.RECOGNIZED,
            recognized_at: new Date(),
            journal_entry_id: journalEntry.id,
          },
        });
        
        result.processed++;
        result.totalRecognizedCents = Money.add(result.totalRecognizedCents, schedule.amount_cents);
        
      } catch (error) {
        logger.error('Recognition failed for schedule', {
          scheduleId: schedule.id,
          error: error.message,
        });
        
        result.errors.push({
          scheduleId: schedule.id,
          invoiceId: schedule.invoice_id,
          error: error.message,
        });
      }
    }
  });
  
  logger.info('Revenue recognition completed', {
    organizationId,
    periodMonth: periodMonth.toISOString().slice(0, 7),
    processed: result.processed,
    skipped: result.skipped,
    errors: result.errors.length,
    totalRecognizedCents: result.totalRecognizedCents,
  });
  
  return result;
}

/**
 * Get pending recognition schedules for a period
 * Uses SKIP LOCKED to prevent duplicate processing in concurrent jobs
 */
async function getPendingSchedules(organizationId, periodMonth, tx) {
  const schedules = await tx.$queryRaw`
    SELECT rrs.id, rrs.invoice_id, rrs.amount_cents, rrs.subscription_id
    FROM revenue_recognition_schedules rrs
    JOIN invoices i ON i.id = rrs.invoice_id
    WHERE rrs.organization_id = ${organizationId}
      AND rrs.period_month = ${periodMonth}
      AND rrs.status = ${RECOGNITION_STATUS.PENDING}
      AND i.status IN ('ISSUED', 'PAID')
    ORDER BY rrs.id
    FOR UPDATE SKIP LOCKED
    LIMIT ${BATCH_SIZE}
  `;
  
  return schedules;
}

/**
 * Void recognition schedules for an invoice (when invoice is voided)
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.invoiceId - Invoice ID
 * @param {Object} params.tx - Prisma transaction client
 * @returns {Promise<number>} Number of schedules voided
 */
export async function voidRecognitionSchedules({ organizationId, invoiceId, tx }) {
  const result = await tx.revenueRecognitionSchedule.updateMany({
    where: {
      organization_id: organizationId,
      invoice_id: invoiceId,
      status: { in: [RECOGNITION_STATUS.PENDING, RECOGNITION_STATUS.SKIPPED] },
    },
    data: {
      status: RECOGNITION_STATUS.VOIDED,
    },
  });
  
  logger.info('Recognition schedules voided', {
    organizationId,
    invoiceId,
    count: result.count,
  });
  
  return result.count;
}

/**
 * Get recognition status for an invoice
 * @param {string} organizationId - Organization ID
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Object>} Recognition status
 */
export async function getInvoiceRecognitionStatus(organizationId, invoiceId) {
  const schedules = await prisma.revenueRecognitionSchedule.findMany({
    where: {
      organization_id: organizationId,
      invoice_id: invoiceId,
    },
    orderBy: { period_month: 'asc' },
  });
  
  const totalAmount = schedules.reduce((sum, s) => Money.add(sum, s.amount_cents), 0);
  const recognizedAmount = schedules
    .filter(s => s.status === RECOGNITION_STATUS.RECOGNIZED)
    .reduce((sum, s) => Money.add(sum, s.amount_cents), 0);
  
  return {
    invoiceId,
    totalSchedules: schedules.length,
    recognizedCount: schedules.filter(s => s.status === RECOGNITION_STATUS.RECOGNIZED).length,
    pendingCount: schedules.filter(s => s.status === RECOGNITION_STATUS.PENDING).length,
    skippedCount: schedules.filter(s => s.status === RECOGNITION_STATUS.SKIPPED).length,
    voidedCount: schedules.filter(s => s.status === RECOGNITION_STATUS.VOIDED).length,
    totalAmountCents: totalAmount,
    recognizedAmountCents: recognizedAmount,
    remainingAmountCents: Money.subtract(totalAmount, recognizedAmount),
    schedules,
  };
}

/**
 * Get deferred revenue waterfall report
 * @param {string} organizationId - Organization ID
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Promise<Array>} Waterfall data
 */
export async function getDeferredRevenueWaterfall(organizationId, fromDate, toDate) {
  const results = await prisma.$queryRaw`
    SELECT
      period_month,
      SUM(amount_cents) AS pending_cents,
      COUNT(*) AS invoice_count
    FROM revenue_recognition_schedules
    WHERE organization_id = ${organizationId}
      AND period_month BETWEEN ${fromDate} AND ${toDate}
      AND status = ${RECOGNITION_STATUS.PENDING}
    GROUP BY period_month
    ORDER BY period_month
  `;
  
  return results;
}

/**
 * Get recognition summary for a period
 * @param {string} organizationId - Organization ID
 * @param {Date} periodMonth - Month to summarize
 * @returns {Promise<Object>} Recognition summary
 */
export async function getRecognitionSummary(organizationId, periodMonth) {
  const schedules = await prisma.revenueRecognitionSchedule.findMany({
    where: {
      organization_id: organizationId,
      period_month: periodMonth,
    },
    include: {
      invoice: {
        select: {
          invoice_number: true,
          customer_name: true,
        },
      },
    },
  });
  
  const summary = {
    periodMonth: periodMonth.toISOString().slice(0, 7),
    total: {
      pending: { count: 0, amountCents: 0 },
      recognized: { count: 0, amountCents: 0 },
      skipped: { count: 0, amountCents: 0 },
      voided: { count: 0, amountCents: 0 },
    },
    schedules: [],
  };
  
  for (const schedule of schedules) {
    const status = schedule.status.toLowerCase();
    summary.total[status].count++;
    summary.total[status].amountCents = Money.add(
      summary.total[status].amountCents,
      schedule.amount_cents
    );
    
    summary.schedules.push({
      id: schedule.id,
      invoiceNumber: schedule.invoice.invoice_number,
      customerName: schedule.invoice.customer_name,
      amountCents: schedule.amount_cents,
      status: schedule.status,
      recognizedAt: schedule.recognized_at,
    });
  }
  
  return summary;
}

/**
 * Check if recognition has already been processed for a period
 * @param {string} organizationId - Organization ID
 * @param {Date} periodMonth - Month to check
 * @returns {Promise<boolean>} Whether period is locked
 */
export async function isPeriodRecognized(organizationId, periodMonth) {
  const count = await prisma.revenueRecognitionSchedule.count({
    where: {
      organization_id: organizationId,
      period_month: periodMonth,
      status: RECOGNITION_STATUS.RECOGNIZED,
    },
  });
  
  return count > 0;
}

/**
 * Get next pending recognition period
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Date|null>} Next period month
 */
export async function getNextPendingPeriod(organizationId) {
  const result = await prisma.revenueRecognitionSchedule.findFirst({
    where: {
      organization_id: organizationId,
      status: RECOGNITION_STATUS.PENDING,
    },
    orderBy: { period_month: 'asc' },
    select: { period_month: true },
  });
  
  return result?.period_month || null;
}

export default {
  createRecognitionSchedules,
  processRecognition,
  voidRecognitionSchedules,
  getInvoiceRecognitionStatus,
  getDeferredRevenueWaterfall,
  getRecognitionSummary,
  isPeriodRecognized,
  getNextPendingPeriod,
};
