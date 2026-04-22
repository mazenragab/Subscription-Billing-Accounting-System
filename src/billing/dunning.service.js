import { addDays, today } from '../shared/utils/date.js';
import { prisma } from '../config/database.js';
import logger from '../shared/utils/logger.js';
import { ConflictError, ValidationError } from '../shared/errors/index.js';

/**
 * Dunning Service
 * Handles retry logic for failed payments and payment collection
 */

/**
 * Schedule dunning attempts for a failed invoice
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.invoiceId - Invoice ID
 * @param {Array<number>} params.retryDays - Days after due date to retry
 * @param {Object} params.tx - Prisma transaction client
 * @returns {Promise<Array>} Created payment attempts
 */
export async function scheduleDunning({ organizationId, invoiceId, retryDays, tx }) {
  const attempts = [];
  const dueDate = await getInvoiceDueDate(invoiceId, tx);
  
  if (!dueDate) {
    throw new ValidationError('Cannot schedule dunning for invoice without due date', [
      { field: 'invoiceId', message: 'Invoice must have due_at set' }
    ]);
  }
  
  const todayDate = today();
  
  for (let i = 0; i < retryDays.length; i++) {
    const retryDaysOffset = retryDays[i];
    const nextRetryAt = addDays(dueDate, retryDaysOffset);
    
    // Only schedule future attempts
    if (nextRetryAt >= todayDate) {
      const attempt = await tx.paymentAttempt.create({
        data: {
          organization_id: organizationId,
          invoice_id: invoiceId,
          customer_id: await getInvoiceCustomerId(invoiceId, tx),
          attempt_number: i + 1,
          status: 'PENDING',
          next_retry_at: nextRetryAt,
        },
      });
      attempts.push(attempt);
    }
  }
  
  logger.info('Dunning scheduled', {
    invoiceId,
    organizationId,
    attemptsCount: attempts.length,
    retryDays,
  });
  
  return attempts;
}

/**
 * Process a dunning attempt for an invoice
 * @param {Object} params
 * @param {string} params.paymentAttemptId - Payment attempt ID
 * @param {Function} params.processPaymentFn - Function to process payment
 * @param {Object} params.tx - Prisma transaction client
 * @returns {Promise<Object>} Payment attempt result
 */
export async function processDunningAttempt({ paymentAttemptId, processPaymentFn, tx }) {
  const attempt = await tx.paymentAttempt.findUnique({
    where: { id: paymentAttemptId },
    include: {
      invoice: {
        include: {
          customer: true,
          subscription: true,
        },
      },
    },
  });
  
  if (!attempt) {
    throw new ValidationError('Payment attempt not found', [
      { field: 'paymentAttemptId', message: 'Invalid attempt ID' }
    ]);
  }
  
  if (attempt.status !== 'PENDING') {
    throw new ConflictError(`Payment attempt already ${attempt.status.toLowerCase()}`);
  }
  
  try {
    // Attempt to process payment
    const paymentResult = await processPaymentFn({
      invoiceId: attempt.invoice_id,
      amountCents: attempt.invoice.total_cents,
      customerId: attempt.customer_id,
    });
    
    // Update attempt as successful
    await tx.paymentAttempt.update({
      where: { id: paymentAttemptId },
      data: {
        status: 'SUCCESS',
        attempted_at: new Date(),
      },
    });
    
    logger.info('Dunning attempt succeeded', {
      paymentAttemptId,
      invoiceId: attempt.invoice_id,
    });
    
    return { success: true, payment: paymentResult };
  } catch (error) {
    // Update attempt as failed
    await tx.paymentAttempt.update({
      where: { id: paymentAttemptId },
      data: {
        status: 'FAILED',
        failure_reason: error.message,
        attempted_at: new Date(),
      },
    });
    
    logger.warn('Dunning attempt failed', {
      paymentAttemptId,
      invoiceId: attempt.invoice_id,
      error: error.message,
      attemptNumber: attempt.attempt_number,
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * Handle max retries reached - cancel subscription and mark invoice uncollectible
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.invoiceId - Invoice ID
 * @param {string} params.subscriptionId - Subscription ID
 * @param {Object} params.tx - Prisma transaction client
 * @returns {Promise<Object>} Result
 */
export async function handleMaxRetriesReached({ organizationId, invoiceId, subscriptionId, tx }) {
  // Update subscription to CANCELLED
  const subscription = await tx.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'CANCELLED',
      cancelled_at: new Date(),
      cancellation_reason: 'Payment failed after max dunning retries',
    },
  });
  
  // Update invoice to UNCOLLECTIBLE
  const invoice = await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'UNCOLLECTIBLE',
      voided_at: new Date(),
    },
  });
  
  // Create status history entry
  await tx.subscriptionStatusHistory.create({
    data: {
      organization_id: organizationId,
      subscription_id: subscriptionId,
      from_status: 'PAST_DUE',
      to_status: 'CANCELLED',
      reason: 'Max dunning retries reached',
    },
  });
  
  logger.info('Max dunning retries reached', {
    invoiceId,
    subscriptionId,
    organizationId,
  });
  
  return { subscription, invoice };
}

/**
 * Get invoice due date
 * @param {string} invoiceId - Invoice ID
 * @param {Object} tx - Prisma transaction client
 * @returns {Promise<Date|null>} Due date
 */
async function getInvoiceDueDate(invoiceId, tx) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: { due_at: true },
  });
  return invoice?.due_at || null;
}

/**
 * Get invoice customer ID
 * @param {string} invoiceId - Invoice ID
 * @param {Object} tx - Prisma transaction client
 * @returns {Promise<string>} Customer ID
 */
async function getInvoiceCustomerId(invoiceId, tx) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: { customer_id: true },
  });
  return invoice?.customer_id;
}

/**
 * Get pending dunning attempts that are ready to process
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {number} params.limit - Batch size limit
 * @param {Object} params.tx - Prisma transaction client
 * @returns {Promise<Array>} Pending attempts
 */
export async function getPendingDunningAttempts({ organizationId, limit = 100, tx }) {
  const now = new Date();
  
  const attempts = await tx.paymentAttempt.findMany({
    where: {
      organization_id: organizationId,
      status: 'PENDING',
      next_retry_at: {
        lte: now,
      },
    },
    take: limit,
    orderBy: { next_retry_at: 'asc' },
  });
  
  return attempts;
}

/**
 * Check if an invoice has reached max retries
 * @param {Object} params
 * @param {string} params.invoiceId - Invoice ID
 * @param {Array<number>} params.retryDays - Configured retry days
 * @param {Object} params.tx - Prisma transaction client
 * @returns {Promise<boolean>} Whether max retries reached
 */
export async function hasReachedMaxRetries({ invoiceId, retryDays, tx }) {
  const attempts = await tx.paymentAttempt.findMany({
    where: {
      invoice_id: invoiceId,
      status: 'FAILED',
    },
  });
  
  return attempts.length >= retryDays.length;
}

export default {
  scheduleDunning,
  processDunningAttempt,
  handleMaxRetriesReached,
  getPendingDunningAttempts,
  hasReachedMaxRetries,
};