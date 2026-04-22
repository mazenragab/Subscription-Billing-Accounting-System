import { Queue, Worker } from 'bullmq';
import redis from '../config/redis.js';
import { prisma } from '../config/database.js';
import logger from '../shared/utils/logger.js';
import { processRecognition, getNextPendingPeriod } from './recognition.service.js';
import { getFirstDayOfMonth, addMonths } from '../shared/utils/date.js';
import config from '../config/env.js';

/**
 * Revenue Recognition Queue and Worker
 * Handles month-end revenue recognition processing
 */

const RECOGNITION_QUEUE_NAME = 'revenue-recognition';

// Create queue for scheduling recognition jobs
export const recognitionQueue = new Queue(RECOGNITION_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

/**
 * Schedule recognition for a specific period
 * @param {Object} params
 * @param {Date} params.periodMonth - Month to recognize (first day of month)
 * @param {string} params.organizationId - Organization ID (optional, null for all)
 * @returns {Promise<Object>} Scheduled job
 */
export async function scheduleRecognition({ periodMonth, organizationId = null }) {
  const jobId = organizationId 
    ? `recognition-${organizationId}-${periodMonth.toISOString().slice(0, 7)}`
    : `recognition-all-${periodMonth.toISOString().slice(0, 7)}`;
  
  const job = await recognitionQueue.add(
    jobId,
    { periodMonth, organizationId },
    { jobId }
  );
  
  logger.info('Recognition job scheduled', {
    periodMonth: periodMonth.toISOString().slice(0, 7),
    organizationId: organizationId || 'ALL',
    jobId: job.id,
  });
  
  return job;
}

/**
 * Schedule month-end recognition for all organizations
 * Called by cron job on 1st of each month at 02:00
 */
export async function scheduleMonthEndRecognition() {
  // Get previous month
  const today = new Date();
  const previousMonth = addMonths(getFirstDayOfMonth(today), -1);
  
  // Get all active organizations
  const organizations = await prisma.organization.findMany({
    where: {
      status: 'ACTIVE',
      deleted_at: null,
    },
    select: { id: true },
  });
  
  let scheduled = 0;
  for (const org of organizations) {
    await scheduleRecognition({
      periodMonth: previousMonth,
      organizationId: org.id,
    });
    scheduled++;
  }
  
  // Also schedule a job to process any pending periods for all orgs
  await scheduleRecognition({
    periodMonth: previousMonth,
    organizationId: null,
  });
  
  logger.info('Month-end recognition scheduled', {
    periodMonth: previousMonth.toISOString().slice(0, 7),
    organizationsCount: scheduled,
  });
  
  return { scheduled, periodMonth: previousMonth };
}

// Create worker for processing recognition
export const recognitionWorker = new Worker(
  RECOGNITION_QUEUE_NAME,
  async (job) => {
    const { periodMonth, organizationId } = job.data;
    
    logger.info('Processing recognition job', {
      jobId: job.id,
      periodMonth: periodMonth.toISOString().slice(0, 7),
      organizationId: organizationId || 'ALL',
      attempt: job.attemptsMade + 1,
    });
    
    try {
      let results = [];
      
      if (organizationId) {
        // Process for specific organization
        const result = await processRecognition({
          organizationId,
          periodMonth,
          createdById: null, // System job
        });
        results.push(result);
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
        }
      }
      
      const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
      
      logger.info('Recognition job completed', {
        jobId: job.id,
        periodMonth: periodMonth.toISOString().slice(0, 7),
        organizationId: organizationId || 'ALL',
        totalProcessed,
        totalErrors,
      });
      
      return {
        processed: totalProcessed,
        errors: totalErrors,
        results,
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
  },
  {
    connection: redis,
    concurrency: 1, // Only one recognition job at a time
    limiter: {
      max: 1,
      duration: 1000,
    },
  }
);

/**
 * Get organizations that have pending recognition schedules for a period
 */
async function getOrganizationsWithPendingSchedules(periodMonth) {
  const results = await prisma.$queryRaw`
    SELECT DISTINCT rrs.organization_id as id
    FROM revenue_recognition_schedules rrs
    JOIN invoices i ON i.id = rrs.invoice_id
    WHERE rrs.period_month = ${periodMonth}
      AND rrs.status = 'PENDING'
      AND i.status IN ('ISSUED', 'PAID')
  `;
  
  return results;
}

// Handle worker events
recognitionWorker.on('completed', (job, result) => {
  logger.info('Recognition worker completed', {
    jobId: job.id,
    result: result,
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

/**
 * Get recognition job status
 * @param {string} periodMonth - Month to check
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Job status
 */
export async function getRecognitionJobStatus(periodMonth, organizationId = null) {
  const jobId = organizationId 
    ? `recognition-${organizationId}-${periodMonth.toISOString().slice(0, 7)}`
    : `recognition-all-${periodMonth.toISOString().slice(0, 7)}`;
  
  const job = await recognitionQueue.getJob(jobId);
  
  if (!job) {
    return { exists: false };
  }
  
  const state = await job.getState();
  
  return {
    exists: true,
    id: job.id,
    state,
    attempts: job.attemptsMade,
    data: job.data,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}

/**
 * Cancel pending recognition job
 * @param {string} periodMonth - Month to cancel
 * @param {string} organizationId - Organization ID
 * @returns {Promise<boolean>} Whether cancelled
 */
export async function cancelRecognitionJob(periodMonth, organizationId = null) {
  const jobId = organizationId 
    ? `recognition-${organizationId}-${periodMonth.toISOString().slice(0, 7)}`
    : `recognition-all-${periodMonth.toISOString().slice(0, 7)}`;
  
  const job = await recognitionQueue.getJob(jobId);
  
  if (job && await job.isWaiting()) {
    await job.remove();
    logger.info('Recognition job cancelled', { jobId });
    return true;
  }
  
  return false;
}

/**
 * Process recognition for all pending periods
 * Useful for catching up after downtime
 */
export async function processAllPendingPeriods() {
  const pendingPeriods = await getPendingPeriods();
  let scheduled = 0;
  
  for (const period of pendingPeriods) {
    await scheduleRecognition({
      periodMonth: period.period_month,
      organizationId: null,
    });
    scheduled++;
  }
  
  logger.info('Scheduled recognition for all pending periods', {
    periodsCount: scheduled,
    periods: pendingPeriods.map(p => p.period_month.toISOString().slice(0, 7)),
  });
  
  return { scheduled, periods: pendingPeriods };
}

/**
 * Get all periods that have pending recognition schedules
 */
async function getPendingPeriods() {
  const results = await prisma.$queryRaw`
    SELECT DISTINCT period_month
    FROM revenue_recognition_schedules
    WHERE status = 'PENDING'
    ORDER BY period_month ASC
  `;
  
  return results;
}

export default {
  recognitionQueue,
  recognitionWorker,
  scheduleRecognition,
  scheduleMonthEndRecognition,
  getRecognitionJobStatus,
  cancelRecognitionJob,
  processAllPendingPeriods,
};
