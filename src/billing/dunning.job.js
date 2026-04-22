import { Queue, Worker } from 'bullmq';
import redis from '../config/redis.js';
import { prisma } from '../config/database.js';
import logger from '../shared/utils/logger.js';
import { 
  processDunningAttempt, 
  getPendingDunningAttempts, 
  handleMaxRetriesReached,
  hasReachedMaxRetries 
} from './dunning.service.js';

/**
 * Dunning Queue and Worker
 * Handles retry logic for failed payments
 */

const DUNNING_QUEUE_NAME = 'dunning-retries';

// Create queue for scheduling dunning attempts
export const dunningQueue = new Queue(DUNNING_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

/**
 * Schedule a dunning attempt for a payment attempt
 * @param {Object} params
 * @param {string} params.paymentAttemptId - Payment attempt ID
 * @param {Date} params.retryAt - Date to run the dunning attempt
 * @returns {Promise<Object>} Scheduled job
 */
export async function scheduleDunningAttempt({ paymentAttemptId, retryAt }) {
  const delay = retryAt.getTime() - Date.now();
  
  if (delay <= 0) {
    // If retry date is in the past, process immediately
    return await dunningQueue.add(
      `dunning-${paymentAttemptId}`,
      { paymentAttemptId },
      { jobId: `dunning-${paymentAttemptId}` }
    );
  }
  
  const job = await dunningQueue.add(
    `dunning-${paymentAttemptId}`,
    { paymentAttemptId },
    {
      delay,
      jobId: `dunning-${paymentAttemptId}`,
    }
  );
  
  logger.info('Dunning attempt scheduled', {
    paymentAttemptId,
    retryAt,
    jobId: job.id,
    delayMs: delay,
  });
  
  return job;
}

/**
 * Cancel a scheduled dunning attempt
 * @param {string} paymentAttemptId - Payment attempt ID
 */
export async function cancelDunningAttempt(paymentAttemptId) {
  const job = await dunningQueue.getJob(`dunning-${paymentAttemptId}`);
  if (job) {
    await job.remove();
    logger.info('Dunning attempt cancelled', { paymentAttemptId });
  }
}

/**
 * Schedule dunning for an invoice
 * @param {Object} params
 * @param {string} params.invoiceId - Invoice ID
 * @param {string} params.organizationId - Organization ID
 * @param {Array<number>} params.retryDays - Days after due date to retry
 * @returns {Promise<Array>} Scheduled jobs
 */
export async function scheduleInvoiceDunning({ invoiceId, organizationId, retryDays }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { due_at: true, customer_id: true, total_cents: true }
  });
  
  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }
  
  if (!invoice.due_at) {
    logger.warn('Cannot schedule dunning for invoice without due date', { invoiceId });
    return [];
  }
  
  const scheduledJobs = [];
  const dueDate = new Date(invoice.due_at);
  
  for (let i = 0; i < retryDays.length; i++) {
    const retryDaysOffset = retryDays[i];
    const retryAt = new Date(dueDate);
    retryAt.setDate(dueDate.getDate() + retryDaysOffset);
    
    // Create payment attempt record
    const paymentAttempt = await prisma.paymentAttempt.create({
      data: {
        organization_id: organizationId,
        invoice_id: invoiceId,
        customer_id: invoice.customer_id,
        attempt_number: i + 1,
        status: 'PENDING',
        next_retry_at: retryAt,
      },
    });
    
    // Schedule the dunning attempt
    const job = await scheduleDunningAttempt({
      paymentAttemptId: paymentAttempt.id,
      retryAt,
    });
    
    scheduledJobs.push({
      paymentAttempt,
      job,
      attemptNumber: i + 1,
      retryAt,
    });
  }
  
  logger.info('Invoice dunning scheduled', {
    invoiceId,
    organizationId,
    attemptsCount: scheduledJobs.length,
    retryDays,
  });
  
  return scheduledJobs;
}

/**
 * Process a dunning attempt with actual payment processing
 * @param {string} paymentAttemptId - Payment attempt ID
 * @param {Object} tx - Prisma transaction client
 * @returns {Promise<Object>} Processing result
 */
async function executeDunningAttempt(paymentAttemptId, tx) {
  // Get payment attempt with related data
  const attempt = await tx.paymentAttempt.findUnique({
    where: { id: paymentAttemptId },
    include: {
      invoice: {
        include: {
          subscription: true,
          customer: true,
        },
      },
    },
  });
  
  if (!attempt) {
    throw new Error(`Payment attempt ${paymentAttemptId} not found`);
  }
  
  if (attempt.status !== 'PENDING') {
    logger.info('Dunning attempt already processed', {
      paymentAttemptId,
      status: attempt.status,
    });
    return { success: false, reason: 'Already processed' };
  }
  
  // Simulate payment processing (replace with actual payment gateway integration)
  const paymentSuccess = await processPayment(attempt.invoice, tx);
  
  if (paymentSuccess) {
    // Update payment attempt as successful
    await tx.paymentAttempt.update({
      where: { id: paymentAttemptId },
      data: {
        status: 'SUCCESS',
        attempted_at: new Date(),
      },
    });
    
    // Update invoice as paid
    await tx.invoice.update({
      where: { id: attempt.invoice_id },
      data: {
        status: 'PAID',
        paid_at: new Date(),
      },
    });
    
    // Update subscription status if it was PAST_DUE
    if (attempt.invoice.subscription?.status === 'PAST_DUE') {
      await tx.subscription.update({
        where: { id: attempt.invoice.subscription_id },
        data: {
          status: 'ACTIVE',
          updated_at: new Date(),
        },
      });
      
      // Create status history entry
      await tx.subscriptionStatusHistory.create({
        data: {
          organization_id: attempt.organization_id,
          subscription_id: attempt.invoice.subscription_id,
          from_status: 'PAST_DUE',
          to_status: 'ACTIVE',
          reason: 'Payment received via dunning',
        },
      });
    }
    
    logger.info('Dunning attempt succeeded', {
      paymentAttemptId,
      invoiceId: attempt.invoice_id,
    });
    
    return { success: true, paymentAttempt: attempt };
  } else {
    // Update payment attempt as failed
    await tx.paymentAttempt.update({
      where: { id: paymentAttemptId },
      data: {
        status: 'FAILED',
        attempted_at: new Date(),
        failure_reason: 'Payment processing failed',
      },
    });
    
    // Check if max retries reached
    const retryDays = [3, 7, 14]; // Default retry days
    const maxRetriesReached = await hasReachedMaxRetries({
      invoiceId: attempt.invoice_id,
      retryDays,
      tx,
    });
    
    if (maxRetriesReached) {
      // Handle max retries - cancel subscription and mark invoice uncollectible
      await handleMaxRetriesReached({
        organizationId: attempt.organization_id,
        invoiceId: attempt.invoice_id,
        subscriptionId: attempt.invoice.subscription_id,
        tx,
      });
      
      logger.warn('Max dunning retries reached', {
        invoiceId: attempt.invoice_id,
        subscriptionId: attempt.invoice.subscription_id,
        organizationId: attempt.organization_id,
      });
    }
    
    logger.warn('Dunning attempt failed', {
      paymentAttemptId,
      invoiceId: attempt.invoice_id,
      attemptNumber: attempt.attempt_number,
    });
    
    return { success: false, paymentAttempt: attempt };
  }
}

/**
 * Simulate payment processing
 * Replace this with actual payment gateway integration
 */
async function processPayment(invoice, tx) {
  // This is a mock implementation
  // In production, integrate with Stripe, Braintree, etc.
  
  // For demo purposes, assume payment succeeds 70% of the time
  const successRate = 0.7;
  const random = Math.random();
  
  logger.info('Processing payment', {
    invoiceId: invoice.id,
    amountCents: invoice.total_cents,
    customerId: invoice.customer_id,
  });
  
  return random < successRate;
}

// Create worker for processing dunning attempts
export const dunningWorker = new Worker(
  DUNNING_QUEUE_NAME,
  async (job) => {
    const { paymentAttemptId } = job.data;
    
    logger.info('Processing dunning job', {
      paymentAttemptId,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
    });
    
    try {
      const result = await prisma.$transaction(async (tx) => {
        return await executeDunningAttempt(paymentAttemptId, tx);
      });
      
      return result;
    } catch (error) {
      logger.error('Dunning job failed', {
        paymentAttemptId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// Handle worker events
dunningWorker.on('completed', (job, result) => {
  logger.info('Dunning job completed', {
    jobId: job.id,
    paymentAttemptId: job.data.paymentAttemptId,
    success: result.success,
  });
});

dunningWorker.on('failed', (job, error) => {
  logger.error('Dunning job failed', {
    jobId: job?.id,
    paymentAttemptId: job?.data?.paymentAttemptId,
    error: error.message,
    attemptsMade: job?.attemptsMade,
  });
});

dunningWorker.on('error', (error) => {
  logger.error('Dunning worker error', {
    error: error.message,
    stack: error.stack,
  });
});

/**
 * Process all pending dunning attempts (for cron jobs)
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID (optional)
 * @param {number} params.limit - Batch size limit
 * @returns {Promise<Object>} Processing result
 */
export async function processPendingDunningAttempts({ organizationId, limit = 100 }) {
  const pendingAttempts = await getPendingDunningAttempts({
    organizationId,
    limit,
    tx: prisma,
  });
  
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  
  for (const attempt of pendingAttempts) {
    try {
      const existingJob = await dunningQueue.getJob(`dunning-${attempt.id}`);
      
      if (!existingJob || await existingJob.isFailed()) {
        await scheduleDunningAttempt({
          paymentAttemptId: attempt.id,
          retryAt: attempt.next_retry_at,
        });
        processed++;
      }
    } catch (error) {
      logger.error('Failed to schedule dunning attempt', {
        paymentAttemptId: attempt.id,
        error: error.message,
      });
      failed++;
    }
  }
  
  logger.info('Processed pending dunning attempts', {
    organizationId,
    processed,
    succeeded,
    failed,
    totalPending: pendingAttempts.length,
  });
  
  return { processed, succeeded, failed, totalPending: pendingAttempts.length };
}

/**
 * Retry a failed dunning attempt manually
 * @param {string} paymentAttemptId - Payment attempt ID
 * @returns {Promise<Object>} Scheduled job
 */
export async function retryDunningAttempt(paymentAttemptId) {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: paymentAttemptId },
  });
  
  if (!attempt) {
    throw new Error(`Payment attempt ${paymentAttemptId} not found`);
  }
  
  if (attempt.status !== 'FAILED') {
    throw new Error(`Cannot retry attempt with status: ${attempt.status}`);
  }
  
  // Reset attempt status to PENDING
  await prisma.paymentAttempt.update({
    where: { id: paymentAttemptId },
    data: {
      status: 'PENDING',
      failure_reason: null,
      attempted_at: null,
    },
  });
  
  // Schedule new attempt
  const job = await scheduleDunningAttempt({
    paymentAttemptId,
    retryAt: new Date(),
  });
  
  logger.info('Dunning attempt retry scheduled', {
    paymentAttemptId,
    jobId: job.id,
  });
  
  return job;
}

/**
 * Get dunning status for an invoice
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Object>} Dunning status
 */
export async function getInvoiceDunningStatus(invoiceId) {
  const attempts = await prisma.paymentAttempt.findMany({
    where: { invoice_id: invoiceId },
    orderBy: { attempt_number: 'asc' },
  });
  
  const lastAttempt = attempts[attempts.length - 1];
  const successfulAttempt = attempts.find(a => a.status === 'SUCCESS');
  
  return {
    invoiceId,
    totalAttempts: attempts.length,
    successfulAttempt: successfulAttempt || null,
    lastAttempt: lastAttempt || null,
    isResolved: !!successfulAttempt,
    isFailed: lastAttempt?.status === 'FAILED' && attempts.length >= (lastAttempt.attempt_number),
    attempts,
  };
}

export default {
  dunningQueue,
  dunningWorker,
  scheduleDunningAttempt,
  cancelDunningAttempt,
  scheduleInvoiceDunning,
  processPendingDunningAttempts,
  retryDunningAttempt,
  getInvoiceDunningStatus,
};