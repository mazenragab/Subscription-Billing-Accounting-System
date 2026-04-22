import { Queue, Worker } from 'bullmq';
import axios from 'axios';
import redis from '../config/redis.js';
import { prisma } from '../config/database.js';
import logger from '../shared/utils/logger.js';
import { generateWebhookSignature } from './webhook.service.js';
import config from '../config/env.js';

/**
 * Webhook Queue and Worker
 * Handles asynchronous webhook delivery with retry logic
 */

const WEBHOOK_QUEUE_NAME = 'webhook-delivery';
const MAX_ATTEMPTS = config.webhooks?.maxAttempts || 3;
const TIMEOUT_MS = config.webhooks?.timeoutMs || 5000;

// Create queue for scheduling webhook deliveries
export const webhookQueue = new Queue(WEBHOOK_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: MAX_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
    timeout: TIMEOUT_MS,
  },
});

/**
 * Deliver webhook to endpoint
 * @param {Object} params - Delivery parameters
 * @returns {Promise<Object>} Delivery result
 */
async function deliverWebhook({ url, secret, eventType, payload, webhookEventId }) {
  const signature = generateWebhookSignature(secret, payload);
  
  const response = await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Event': eventType,
      'X-Webhook-Signature': signature,
      'X-Webhook-Delivery': webhookEventId,
      'User-Agent': 'Billing-System-Webhook/1.0',
    },
    timeout: TIMEOUT_MS,
    validateStatus: (status) => status >= 200 && status < 300,
  });
  
  return {
    success: true,
    statusCode: response.status,
    responseData: response.data,
  };
}

/**
 * Process webhook delivery job
 * @param {Object} job - BullMQ job
 * @returns {Promise<Object>} Delivery result
 */
async function processWebhookDelivery(job) {
  const {
    webhookEventId,
    endpointId,
    organizationId,
    url,
    secret,
    eventType,
    payload,
  } = job.data;
  
  const startTime = Date.now();
  
  logger.info('Processing webhook delivery', {
    jobId: job.id,
    webhookEventId,
    endpointId,
    eventType,
    attempt: job.attemptsMade + 1,
  });
  
  try {
    // Update webhook event status to processing
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: 'PENDING',
        last_attempted_at: new Date(),
        attempts: { increment: 1 },
      },
    });
    
    // Deliver the webhook
    const result = await deliverWebhook({
      url,
      secret,
      eventType,
      payload,
      webhookEventId,
    });
    
    const duration = Date.now() - startTime;
    
    // Update webhook event as delivered
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: 'DELIVERED',
        delivered_at: new Date(),
        last_attempted_at: new Date(),
      },
    });
    
    logger.info('Webhook delivered successfully', {
      jobId: job.id,
      webhookEventId,
      endpointId,
      eventType,
      duration,
      statusCode: result.statusCode,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const isLastAttempt = job.attemptsMade + 1 >= MAX_ATTEMPTS;
    
    logger.error('Webhook delivery failed', {
      jobId: job.id,
      webhookEventId,
      endpointId,
      eventType,
      duration,
      attempt: job.attemptsMade + 1,
      maxAttempts: MAX_ATTEMPTS,
      isLastAttempt,
      error: error.message,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
    });
    
    // Update webhook event status
    const newStatus = isLastAttempt ? 'FAILED' : 'PENDING';
    
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: newStatus,
        last_attempted_at: new Date(),
        attempts: { increment: 1 },
      },
    });
    
    // Re-throw to trigger BullMQ retry
    throw error;
  }
}

// Create worker for processing webhook deliveries
export const webhookWorker = new Worker(
  WEBHOOK_QUEUE_NAME,
  async (job) => {
    return await processWebhookDelivery(job);
  },
  {
    connection: redis,
    concurrency: 10, // Process up to 10 webhooks concurrently
    limiter: {
      max: 50, // Max 50 jobs per second
      duration: 1000,
    },
  }
);

// Handle worker events
webhookWorker.on('completed', (job, result) => {
  logger.debug('Webhook worker completed', {
    jobId: job.id,
    result: result.success,
  });
});

webhookWorker.on('failed', (job, error) => {
  logger.error('Webhook worker failed', {
    jobId: job?.id,
    webhookEventId: job?.data?.webhookEventId,
    error: error.message,
    attemptsMade: job?.attemptsMade,
  });
});

webhookWorker.on('error', (error) => {
  logger.error('Webhook worker error', {
    error: error.message,
    stack: error.stack,
  });
});

/**
 * Retry failed webhook events
 * @param {string} organizationId - Organization ID
 * @param {string} eventId - Webhook event ID
 * @returns {Promise<Object>} Rescheduled job
 */
export async function retryFailedWebhook(organizationId, eventId) {
  const webhookEvent = await prisma.webhookEvent.findFirst({
    where: {
      id: eventId,
      organization_id: organizationId,
      status: 'FAILED',
    },
    include: {
      endpoint: true,
    },
  });
  
  if (!webhookEvent) {
    throw new Error('Webhook event not found or not failed');
  }
  
  // Reset the event
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: {
      status: 'PENDING',
      attempts: 0,
      last_attempted_at: null,
      delivered_at: null,
    },
  });
  
  // Queue for delivery
  const job = await webhookQueue.add(
    `webhook-${webhookEvent.id}`,
    {
      webhookEventId: webhookEvent.id,
      endpointId: webhookEvent.endpoint_id,
      organizationId,
      url: webhookEvent.endpoint.url,
      secret: webhookEvent.endpoint.secret,
      eventType: webhookEvent.event_type,
      payload: webhookEvent.payload,
    },
    {
      attempts: MAX_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    }
  );
  
  logger.info('Failed webhook retry scheduled', {
    organizationId,
    eventId,
    jobId: job.id,
  });
  
  return job;
}

/**
 * Get webhook queue metrics
 * @returns {Promise<Object>} Queue metrics
 */
export async function getWebhookQueueMetrics() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    webhookQueue.getWaitingCount(),
    webhookQueue.getActiveCount(),
    webhookQueue.getCompletedCount(),
    webhookQueue.getFailedCount(),
    webhookQueue.getDelayedCount(),
  ]);
  
  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Pause webhook delivery
 * @returns {Promise<void>}
 */
export async function pauseWebhookDelivery() {
  await webhookQueue.pause();
  logger.info('Webhook delivery paused');
}

/**
 * Resume webhook delivery
 * @returns {Promise<void>}
 */
export async function resumeWebhookDelivery() {
  await webhookQueue.resume();
  logger.info('Webhook delivery resumed');
}

/**
 * Clean up old webhook events
 * @param {number} daysToKeep - Days to keep events (default: 30)
 * @returns {Promise<number>} Number of deleted events
 */
export async function cleanupOldWebhookEvents(daysToKeep = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const result = await prisma.webhookEvent.deleteMany({
    where: {
      created_at: { lt: cutoffDate },
      status: { in: ['DELIVERED', 'FAILED'] },
    },
  });
  
  logger.info('Cleaned up old webhook events', {
    daysToKeep,
    deletedCount: result.count,
  });
  
  return result.count;
}

export default {
  webhookQueue,
  webhookWorker,
  retryFailedWebhook,
  getWebhookQueueMetrics,
  pauseWebhookDelivery,
  resumeWebhookDelivery,
  cleanupOldWebhookEvents,
};