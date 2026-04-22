/**
 * Revenue Recognition Worker
 * 
 * Processes month-end revenue recognition for deferred revenue.
 * Runs automatically when recognition jobs are queued.
 * 
 * The recognition job is typically scheduled via cron at 02:00 on the 1st of each month.
 */

import { Worker } from 'bullmq';
import redis from '../src/config/redis.js';
import { prisma } from '../src/config/database.js';
import logger from '../src/shared/utils/logger.js';
import { processRecognition, getNextPendingPeriod } from '../src/accounting/recognition.service.js';
import { emitEvent, WEBHOOK_EVENTS } from '../src/webhooks/webhook.service.js';
import config from '../src/config/env.js';

const RECOGNITION_QUEUE_NAME = 'revenue-recognition';
const BATCH_SIZE = config.billing?.recognitionBatchSize || 100;

/**
 * Process a recognition job
 * @param {Object} job - BullMQ job
 * @returns {Promise<Object>} Recognition result
 */
async function processRecognitionJob(job) {
  const { periodMonth, organizationId } = job.data;
  
  logger.info('Processing recognition job', {
    jobId: job.id,
    periodMonth: periodMonth.toISOString().slice(0, 7),
    organizationId: organizationId || 'ALL',
    attempt: job.attemptsMade + 1,
  });
  
  const startTime = Date.now();
  let results = [];
  
  try {
    if (organizationId) {
      // Process for specific organization
      const result = await processRecognition({
        organizationId,
        periodMonth,
        createdById: null, // System job
      });
      results.push(result);
      
      // Emit webhook event if recognition was completed
      if (result.processed > 0) {
        await emitEvent(organizationId, WEBHOOK_EVENTS.RECOGNITION_COMPLETED, {
          period_month: periodMonth,
          processed_count: result.processed,
          total_recognized_cents: result.totalRecognizedCents,
          skipped_count: result.skipped,
          error_count: result.errors.length,
        });
      }
    } else {
      // Process for all organizations with pending schedules
      const organizations = await getOrganizationsWithPendingSchedules(periodMonth);
      
      for (const org of organizations) {
        const result = await processRecognition({
          organizationId: org.id,
          periodMonth,
          createdById: null,
        });
        results.push(result);
        
        // Emit webhook event for each organization
        if (result.processed > 0) {
          await emitEvent(org.id, WEBHOOK_EVENTS.RECOGNITION_COMPLETED, {
            period_month: periodMonth,
            processed_count: result.processed,
            total_recognized_cents: result.totalRecognizedCents,
            skipped_count: result.skipped,
            error_count: result.errors.length,
          });
        }
      }
    }
    
    const duration = Date.now() - startTime;
    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    
    logger.info('Recognition job completed', {
      jobId: job.id,
      periodMonth: periodMonth.toISOString().slice(0, 7),
      organizationId: organizationId || 'ALL',
      totalProcessed,
      totalErrors,
      duration,
    });
    
    return {
      processed: totalProcessed,
      errors: totalErrors,
      results,
      duration,
    };
  } catch (error) {
    logger.error('Recognition job failed', {
      jobId: job.id,
      periodMonth: periodMonth.toISOString().slice(0, 7),
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Get organizations that have pending recognition schedules
 * @param {Date} periodMonth - Period month
 * @returns {Promise<Array>} Organizations
 */
async function getOrganizationsWithPendingSchedules(periodMonth) {
  const results = await prisma.$queryRaw`
    SELECT DISTINCT rrs.organization_id as id
    FROM revenue_recognition_schedules rrs
    JOIN invoices i ON i.id = rrs.invoice_id
    WHERE rrs.period_month = ${periodMonth}
      AND rrs.status = 'PENDING'
      AND i.status IN ('ISSUED', 'PAID')
    LIMIT 1000
  `;
  
  return results;
}

// Create the worker
export const recognitionWorker = new Worker(
  RECOGNITION_QUEUE_NAME,
  async (job) => {
    return await processRecognitionJob(job);
  },
  {
    connection: redis,
    concurrency: 1, // Only one recognition job at a time
    limiter: {
      max: 1,
      duration: 1000,
    },
    settings: {
      lockDuration: 600000, // 10 minutes lock
      stalledInterval: 30000,
    },
  }
);

// Handle worker events
recognitionWorker.on('completed', (job, result) => {
  logger.info('Recognition worker completed', {
    jobId: job.id,
    processed: result.processed,
    errors: result.errors,
  });
});

recognitionWorker.on('failed', (job, error) => {
  logger.error('Recognition worker failed', {
    jobId: job?.id,
    error: error.message,
    attemptsMade: job?.attemptsMade,
  });
});

recognitionWorker.on('error', (error) => {
  logger.error('Recognition worker error', {
    error: error.message,
    stack: error.stack,
  });
});

// Handle stalled jobs
recognitionWorker.on('stalled', (jobId) => {
  logger.warn('Recognition job stalled', { jobId });
});

export default recognitionWorker;
