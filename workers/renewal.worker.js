/**
 * Renewal Worker
 * 
 * Processes subscription auto-renewals at period end.
 * Creates new invoices and updates subscription periods.
 */

import { Worker } from 'bullmq';
import redis from '../src/config/redis.js';
import { prisma } from '../src/config/database.js';
import logger from '../src/shared/utils/logger.js';
import { calculateNextPeriod, canRenewSubscription } from '../src/billing/billing-cycle.service.js';
import { emitEvent, WEBHOOK_EVENTS } from '../src/webhooks/webhook.service.js';

const RENEWAL_QUEUE_NAME = 'subscription-renewals';

/**
 * Process a renewal job
 * @param {Object} job - BullMQ job
 * @returns {Promise<Object>} Renewal result
 */
async function processRenewalJob(job) {
  const { subscriptionId } = job.data;
  
  logger.info('Processing renewal job', {
    jobId: job.id,
    subscriptionId,
    attempt: job.attemptsMade + 1,
  });
  
  const startTime = Date.now();
  
  try {
    const result = await prisma.$transaction(async (tx) => {
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
      const now = new Date();
      if (subscription.current_period_end > now) {
        logger.info('Renewal not yet due', {
          subscriptionId,
          periodEnd: subscription.current_period_end,
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
      
      if (!plan) {
        throw new Error(`Plan ${planId} not found`);
      }
      
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
      
      // Emit renewal webhook
      await emitEvent(subscription.organization_id, WEBHOOK_EVENTS.SUBSCRIPTION_RENEWED, {
        subscription_id: subscriptionId,
        old_plan_id: subscription.plan_id,
        new_plan_id: planId,
        old_period_end: subscription.current_period_end,
        new_period_start: periodStart,
        new_period_end: periodEnd,
        amount_cents: plan.amount_cents,
      });
      
      // If plan was changed, emit upgrade/downgrade webhook
      if (subscription.pending_plan_id) {
        const isUpgrade = plan.amount_cents > subscription.plan.amount_cents;
        await emitEvent(subscription.organization_id, 
          isUpgrade ? WEBHOOK_EVENTS.SUBSCRIPTION_UPGRADED : WEBHOOK_EVENTS.SUBSCRIPTION_DOWNGRADED,
          {
            subscription_id: subscriptionId,
            old_plan_id: subscription.plan_id,
            new_plan_id: planId,
            old_amount_cents: subscription.plan.amount_cents,
            new_amount_cents: plan.amount_cents,
          }
        );
      }
      
      return {
        renewed: true,
        subscription: updatedSubscription,
        periodStart,
        periodEnd,
        plan,
      };
    });
    
    const duration = Date.now() - startTime;
    
    logger.info('Renewal job completed', {
      jobId: job.id,
      subscriptionId,
      renewed: result.renewed,
      duration,
    });
    
    return result;
  } catch (error) {
    logger.error('Renewal job failed', {
      jobId: job.id,
      subscriptionId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// Create the worker
export const renewalWorker = new Worker(
  RENEWAL_QUEUE_NAME,
  async (job) => {
    return await processRenewalJob(job);
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
    settings: {
      lockDuration: 60000,
      stalledInterval: 30000,
    },
  }
);

// Handle worker events
renewalWorker.on('completed', (job, result) => {
  logger.info('Renewal worker completed', {
    jobId: job.id,
    subscriptionId: job.data.subscriptionId,
    renewed: result.renewed,
  });
});

renewalWorker.on('failed', (job, error) => {
  logger.error('Renewal worker failed', {
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

renewalWorker.on('stalled', (jobId) => {
  logger.warn('Renewal job stalled', { jobId });
});

export default renewalWorker;