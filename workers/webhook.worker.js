/**
 * Webhook Worker
 * 
 * Delivers webhook events to external endpoints with retry logic.
 * Uses exponential backoff for failed deliveries.
 */

import { Worker } from 'bullmq';
import axios from 'axios';
import redis from '../src/config/redis.js';
import { prisma } from '../src/config/database.js';
import logger from '../src/shared/utils/logger.js';
import { generateWebhookSignature } from '../src/webhooks/webhook.service.js';
import config from '../src/config/env.js';

const WEBHOOK_QUEUE_NAME = 'webhook-delivery';
const MAX_ATTEMPTS = config.webhooks?.maxAttempts || 3;
const TIMEOUT_MS = config.webhooks?.timeoutMs || 5000;

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
      'X-Webhook-Attempt': '1',
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
 * Process a webhook delivery job
 * @param {Object} job - BullMQ job
 * @returns {Promise<Object>} Delivery result
 */
async function processWebhookJob(job) {
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
  const attemptNumber = job.attemptsMade + 1;
  const isLastAttempt = attemptNumber >= MAX_ATTEMPTS;
  
  logger.info('Processing webhook delivery', {
    jobId: job.id,
    webhookEventId,
    endpointId,
    eventType,
    attempt: attemptNumber,
    maxAttempts: MAX_ATTEMPTS,
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
      attempt: attemptNumber,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const newStatus = isLastAttempt ? 'FAILED' : 'PENDING';
    
    logger.error('Webhook delivery failed', {
      jobId: job.id,
      webhookEventId,
      endpointId,
      eventType,
      duration,
      attempt: attemptNumber,
      maxAttempts: MAX_ATTEMPTS,
      isLastAttempt,
      error: error.message,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
    });
    
    // Update webhook event status
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: newStatus,
        last_attempted_at: new Date(),
        attempts: { increment: 1 },
      },
    });
    
    // If this is the last attempt, log final failure
    if (isLastAttempt) {
      logger.error('Webhook permanently failed after max retries', {
        webhookEventId,
        endpointId,
        eventType,
        totalAttempts: MAX_ATTEMPTS,
      });
    }
    
    // Re-throw to trigger BullMQ retry
    throw error;
  }
}

// Create the worker
export const webhookWorker = new Worker(
  WEBHOOK_QUEUE_NAME,
  async (job) => {
    return await processWebhookJob(job);
  },
  {
    connection: redis,
    concurrency: 10,
    limiter: {
      max: 50,
      duration: 1000,
    },
    settings: {
      lockDuration: 30000,
      stalledInterval: 15000,
      maxStalledCount: 3,
    },
  }
);

// Handle worker events
webhookWorker.on('completed', (job, result) => {
  logger.debug('Webhook worker completed', {
    jobId: job.id,
    webhookEventId: job.data.webhookEventId,
    success: result.success,
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

webhookWorker.on('stalled', (jobId) => {
  logger.warn('Webhook job stalled', { jobId });
});

export default webhookWorker;