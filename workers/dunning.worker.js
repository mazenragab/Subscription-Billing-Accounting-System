/**
 * Dunning Worker
 * 
 * Processes failed payment retries according to dunning schedule.
 * Automatically retries payments on configured days after due date.
 */

import { Worker } from 'bullmq';
import redis from '../src/config/redis.js';
import { prisma } from '../src/config/database.js';
import logger from '../src/shared/utils/logger.js';
import { 
  processDunningAttempt, 
  handleMaxRetriesReached,
  hasReachedMaxRetries 
} from '../src/billing/dunning.service.js';
import { emitEvent, WEBHOOK_EVENTS } from '../src/webhooks/webhook.service.js';

const DUNNING_QUEUE_NAME = 'dunning-retries';

/**
 * Process a dunning attempt
 * @param {Object} job - BullMQ job
 * @returns {Promise<Object>} Processing result
 */
async function processDunningJob(job) {
  const { paymentAttemptId } = job.data;
  
  logger.info('Processing dunning job', {
    jobId: job.id,
    paymentAttemptId,
    attempt: job.attemptsMade + 1,
  });
  
  const startTime = Date.now();
  
  try {
    // Get payment attempt with related data
    const attempt = await prisma.paymentAttempt.findUnique({
      where: { id: paymentAttemptId },
      include: {
        invoice: {
          include: {
            customer: true,
            subscription: true,
            organization: {
              include: {
                billing_settings: true,
              },
            },
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
    
    // Process the payment attempt
    const result = await prisma.$transaction(async (tx) => {
      return await processDunningAttempt({
        paymentAttemptId,
        processPaymentFn: async ({ invoiceId, amountCents, customerId }) => {
          // Simulate payment processing
          // In production, integrate with Stripe, Braintree, etc.
          const paymentSuccess = await simulatePaymentProcessing(attempt.invoice);
          
          if (paymentSuccess) {
            // Record successful payment
            const payment = await tx.payment.create({
              data: {
                organization_id: attempt.organization_id,
                invoice_id: attempt.invoice_id,
                customer_id: attempt.customer_id,
                amount_cents: attempt.invoice.total_cents,
                currency: 'USD',
                method: 'BANK_TRANSFER',
                idempotency_key: `dunning-${attempt.id}-${Date.now()}`,
                paid_at: new Date(),
              },
            });
            
            // Emit payment succeeded webhook
            await emitEvent(attempt.organization_id, WEBHOOK_EVENTS.PAYMENT_SUCCEEDED, {
              payment_id: payment.id,
              invoice_id: attempt.invoice_id,
              amount_cents: payment.amount_cents,
              method: payment.method,
              paid_at: payment.paid_at,
            });
            
            return { success: true, payment };
          }
          
          // Emit payment failed webhook
          await emitEvent(attempt.organization_id, WEBHOOK_EVENTS.PAYMENT_FAILED, {
            invoice_id: attempt.invoice_id,
            amount_cents: attempt.invoice.total_cents,
            failure_reason: 'Insufficient funds',
            attempt_number: attempt.attempt_number,
          });
          
          return { success: false, error: 'Payment processing failed' };
        },
        tx,
      });
    });
    
    const duration = Date.now() - startTime;
    
    // Check if max retries reached after failed attempt
    if (!result.success && attempt.invoice.subscription) {
      const retryDays = attempt.invoice.organization.billing_settings?.dunning_retry_days || [3, 7, 14];
      const maxRetriesReached = await hasReachedMaxRetries({
        invoiceId: attempt.invoice_id,
        retryDays,
        tx: prisma,
      });
      
      if (maxRetriesReached) {
        await prisma.$transaction(async (tx) => {
          await handleMaxRetriesReached({
            organizationId: attempt.organization_id,
            invoiceId: attempt.invoice_id,
            subscriptionId: attempt.invoice.subscription_id,
            tx,
          });
        });
        
        // Emit webhook events
        await emitEvent(attempt.organization_id, WEBHOOK_EVENTS.SUBSCRIPTION_CANCELLED, {
          subscription_id: attempt.invoice.subscription_id,
          reason: 'Payment failed after max dunning retries',
          cancelled_at: new Date(),
        });
        
        await emitEvent(attempt.organization_id, WEBHOOK_EVENTS.INVOICE_UNCOLLECTIBLE, {
          invoice_id: attempt.invoice_id,
          invoice_number: attempt.invoice.invoice_number,
          total_cents: attempt.invoice.total_cents,
        });
      }
    }
    
    logger.info('Dunning job completed', {
      jobId: job.id,
      paymentAttemptId,
      success: result.success,
      duration,
    });
    
    return result;
  } catch (error) {
    logger.error('Dunning job failed', {
      jobId: job.id,
      paymentAttemptId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Simulate payment processing
 * In production, replace with actual payment gateway integration
 */
async function simulatePaymentProcessing(invoice) {
  // For demo purposes, assume payment succeeds 70% of the time
  // In production, this would call Stripe, Braintree, etc.
  const successRate = 0.7;
  const random = Math.random();
  
  logger.debug('Simulating payment processing', {
    invoiceId: invoice.id,
    amountCents: invoice.total_cents,
    success: random < successRate,
  });
  
  return random < successRate;
}

// Create the worker
export const dunningWorker = new Worker(
  DUNNING_QUEUE_NAME,
  async (job) => {
    return await processDunningJob(job);
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
    settings: {
      lockDuration: 30000,
      stalledInterval: 15000,
    },
  }
);

// Handle worker events
dunningWorker.on('completed', (job, result) => {
  logger.info('Dunning worker completed', {
    jobId: job.id,
    paymentAttemptId: job.data.paymentAttemptId,
    success: result.success,
  });
});

dunningWorker.on('failed', (job, error) => {
  logger.error('Dunning worker failed', {
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

dunningWorker.on('stalled', (jobId) => {
  logger.warn('Dunning job stalled', { jobId });
});

export default dunningWorker;