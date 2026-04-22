import { Queue, Worker } from 'bullmq';
import redis from '../config/redis.js';
import { prisma } from '../config/database.js';
import logger from '../shared/utils/logger.js';
import { calculateNextPeriod, canRenewSubscription } from './billing-cycle.service.js';
import { generateIssuedInvoiceForPeriod } from './invoice-generation.service.js';

/**
 * Renewal Queue and Worker
 * Handles automatic subscription renewal at period end
 */

const RENEWAL_QUEUE_NAME = 'subscription-renewals';

// Create queue for scheduling renewals
export const renewalQueue = new Queue(RENEWAL_QUEUE_NAME, {
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
 * Schedule a renewal job for a subscription
 * @param {Object} params
 * @param {string} params.subscriptionId - Subscription ID
 * @param {Date} params.renewalDate - Date to run renewal
 * @returns {Promise<Object>} Scheduled job
 */
export async function scheduleRenewal({ subscriptionId, renewalDate }) {
  const delay = renewalDate.getTime() - Date.now();
  
  if (delay <= 0) {
    return await renewalQueue.add(
      `renewal-${subscriptionId}`,
      { subscriptionId },
      { jobId: `renewal-${subscriptionId}` }
    );
  }
  
  const job = await renewalQueue.add(
    `renewal-${subscriptionId}`,
    { subscriptionId },
    {
      delay,
      jobId: `renewal-${subscriptionId}`,
    }
  );
  
  logger.info('Renewal scheduled', {
    subscriptionId,
    renewalDate,
    jobId: job.id,
    delayMs: delay,
  });
  
  return job;
}

/**
 * Cancel a scheduled renewal job
 * @param {string} subscriptionId - Subscription ID
 */
export async function cancelRenewal(subscriptionId) {
  const job = await renewalQueue.getJob(`renewal-${subscriptionId}`);
  if (job) {
    await job.remove();
    logger.info('Renewal cancelled', { subscriptionId });
  }
}

/**
 * Process subscription renewal
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} tx - Prisma transaction client (optional)
 * @param {Object} options - Renewal options
 * @param {Date} options.effectiveDate - Date used to determine whether renewal is due
 * @param {boolean} options.generateInvoice - Whether to generate an invoice for the new period
 * @param {Date} options.invoiceIssuedAt - Issue date for generated invoice
 * @param {string|null} options.createdById - User ID triggering the renewal (if manual)
 * @returns {Promise<Object>} Renewal result
 */
export async function processRenewal(subscriptionId, tx = prisma, options = {}) {
  const effectiveDate = options.effectiveDate || new Date();
  const shouldGenerateInvoice = options.generateInvoice !== false;
  const invoiceIssuedAt = options.invoiceIssuedAt || effectiveDate;
  const createdById = options.createdById ?? null;

  const subscription = await tx.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      customer: true,
      organization: {
        include: {
          billing_settings: true,
        },
      },
    },
  });
  
  if (!subscription) {
    throw new Error(`Subscription ${subscriptionId} not found`);
  }
  
  // Check if subscription can be renewed
  if (!canRenewSubscription(subscription)) {
    logger.info('Subscription not eligible for renewal', {
      subscriptionId,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
    return { renewed: false, reason: 'Not eligible for renewal' };
  }
  
  // Check if renewal is due
  if (subscription.current_period_end > effectiveDate) {
    logger.info('Renewal not yet due', {
      subscriptionId,
      periodEnd: subscription.current_period_end,
      effectiveDate,
    });
    return { renewed: false, reason: 'Renewal not yet due' };
  }
  
  // Calculate next period
  const { periodStart, periodEnd } = calculateNextPeriod({
    currentPeriodEnd: subscription.current_period_end,
    anchorDay: subscription.billing_anchor_day,
    interval: subscription.plan.interval,
  });
  
  // Determine new plan (use pending plan if set)
  const planId = subscription.pending_plan_id || subscription.plan_id;
  const plan = planId === subscription.plan_id 
    ? subscription.plan 
    : await tx.plan.findUnique({ where: { id: planId } });
  
  // Update subscription
  const updatedSubscription = await tx.subscription.update({
    where: { id: subscriptionId },
    data: {
      current_period_start: periodStart,
      current_period_end: periodEnd,
      plan_id: planId,
      pending_plan_id: null,
      status: 'ACTIVE',
      updated_at: new Date(),
    },
  });
  
  // Create status history entry
  await tx.subscriptionStatusHistory.create({
    data: {
      organization_id: subscription.organization_id,
      subscription_id: subscriptionId,
      from_status: subscription.status,
      to_status: 'ACTIVE',
      reason: 'Auto-renewal',
    },
  });
  
  logger.info('Subscription renewed', {
    subscriptionId,
    oldPeriodEnd: subscription.current_period_end,
    newPeriodStart: periodStart,
    newPeriodEnd: periodEnd,
    planId,
  });

  let invoice = null;
  if (shouldGenerateInvoice) {
    invoice = await generateIssuedInvoiceForPeriod({
      organizationId: subscription.organization_id,
      subscriptionId: updatedSubscription.id,
      customerId: subscription.customer_id,
      customerName: subscription.customer.name,
      customerEmail: subscription.customer.email,
      plan,
      periodStart,
      periodEnd,
      issuedAt: invoiceIssuedAt,
      createdById,
      tx,
      notes: 'Auto-generated from subscription renewal',
    });
  }
  
  return {
    renewed: true,
    subscription: updatedSubscription,
    customer: subscription.customer,
    periodStart,
    periodEnd,
    plan,
    invoice,
  };
}

// Create worker for processing renewals
export const renewalWorker = new Worker(
  RENEWAL_QUEUE_NAME,
  async (job) => {
    const { subscriptionId } = job.data;
    
    logger.info('Processing renewal job', {
      subscriptionId,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
    });
    
    try {
      const result = await prisma.$transaction(async (tx) => {
        return await processRenewal(subscriptionId, tx);
      });
      
      return result;
    } catch (error) {
      logger.error('Renewal job failed', {
        subscriptionId,
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
renewalWorker.on('completed', (job, result) => {
  logger.info('Renewal job completed', {
    jobId: job.id,
    subscriptionId: job.data.subscriptionId,
    renewed: result.renewed,
  });
});

renewalWorker.on('failed', (job, error) => {
  logger.error('Renewal job failed', {
    jobId: job?.id,
    subscriptionId: job?.data?.subscriptionId,
    error: error.message,
    attemptsMade: job?.attemptsMade,
  });
});

renewalWorker.on('error', (error) => {
  logger.error('Renewal worker error', {
    error: error.message,
    stack: error.stack,
  });
});

/**
 * Schedule renewals for all active subscriptions on startup
 * @returns {Promise<Object>} Result
 */
export async function scheduleAllRenewals() {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIALING'] },
      cancel_at_period_end: false,
      current_period_end: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      current_period_end: true,
    },
  });
  
  let scheduled = 0;
  let failed = 0;
  
  for (const sub of subscriptions) {
    try {
      await scheduleRenewal({
        subscriptionId: sub.id,
        renewalDate: sub.current_period_end,
      });
      scheduled++;
    } catch (error) {
      logger.error('Failed to schedule renewal', {
        subscriptionId: sub.id,
        error: error.message,
      });
      failed++;
    }
  }
  
  logger.info('Scheduled renewals on startup', { scheduled, failed, total: subscriptions.length });
  return { scheduled, failed, total: subscriptions.length };
}

/**
 * Reschedule a renewal for a subscription (after plan change)
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object>} Result
 */
export async function rescheduleRenewal(subscriptionId) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { current_period_end: true },
  });
  
  if (!subscription) {
    throw new Error(`Subscription ${subscriptionId} not found`);
  }
  
  await cancelRenewal(subscriptionId);
  return await scheduleRenewal({
    subscriptionId,
    renewalDate: subscription.current_period_end,
  });
}

export default {
  renewalQueue,
  renewalWorker,
  scheduleRenewal,
  cancelRenewal,
  processRenewal,
  scheduleAllRenewals,
  rescheduleRenewal,
};
