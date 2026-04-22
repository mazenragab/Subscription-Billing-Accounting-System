/**
 * Worker Process Entry Point
 * 
 * This file starts all background workers for the billing system.
 * Run with: npm run worker or node workers/index.js
 * 
 * Workers:
 * - Recognition: Month-end revenue recognition
 * - Dunning: Failed payment retry handling
 * - Renewal: Subscription auto-renewal at period end
 * - Webhook: Outbound webhook delivery
 */

import { createServer } from 'http';
import { recognitionWorker, recognitionQueue } from '../src/accounting/recognition.job.js';
import { dunningWorker, dunningQueue } from '../src/billing/dunning.job.js';
import { renewalWorker, renewalQueue, scheduleAllRenewals } from '../src/billing/renewal.job.js';
import { webhookWorker, webhookQueue } from '../src/webhooks/webhook.job.js';
import { prisma } from '../src/config/database.js';
import redis from '../src/config/redis.js';
import logger from '../src/shared/utils/logger.js';
import config from '../src/config/env.js';

// Worker configuration
const WORKER_PORT = process.env.WORKER_PORT || 3001;

/**
 * Health check server for workers
 * Allows monitoring systems to check worker health
 */
function startHealthServer() {
  const server = createServer(async (req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      try {
        // Check database connection
        await prisma.$queryRaw`SELECT 1`;
        
        // Check redis connection
        await redis.ping();
        
        // Get queue metrics
        const recognitionMetrics = await getQueueMetrics(recognitionQueue);
        const dunningMetrics = await getQueueMetrics(dunningQueue);
        const renewalMetrics = await getQueueMetrics(renewalQueue);
        const webhookMetrics = await getQueueMetrics(webhookQueue);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          workers: {
            recognition: { running: true, metrics: recognitionMetrics },
            dunning: { running: true, metrics: dunningMetrics },
            renewal: { running: true, metrics: renewalMetrics },
            webhook: { running: true, metrics: webhookMetrics },
          },
        }));
      } catch (error) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString(),
        }));
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  
  server.listen(WORKER_PORT, () => {
    logger.info('Worker health server started', { port: WORKER_PORT });
  });
  
  return server;
}

/**
 * Get queue metrics
 * @param {Queue} queue - BullMQ queue
 * @returns {Promise<Object>} Queue metrics
 */
async function getQueueMetrics(queue) {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  } catch (error) {
    logger.error('Failed to get queue metrics', { error: error.message });
    return { error: error.message };
  }
}

/**
 * Schedule recurring jobs
 */
async function scheduleRecurringJobs() {
  // Schedule renewals for all active subscriptions on startup
  try {
    const result = await scheduleAllRenewals();
    logger.info('Initial renewal scheduling completed', result);
  } catch (error) {
    logger.error('Failed to schedule initial renewals', { error: error.message });
  }
  
  // Note: Recognition jobs are scheduled by cron at month-end
  // Dunning jobs are scheduled dynamically when invoices become due
  // Webhook jobs are scheduled dynamically when events are emitted
}

/**
 * Graceful shutdown handler
 * Ensures all workers finish processing before exiting
 */
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout, forcing exit');
    process.exit(1);
  }, 30000); // 30 seconds max
  
  try {
    // Close all workers (stop accepting new jobs)
    logger.info('Closing workers...');
    await Promise.all([
      recognitionWorker.close(),
      dunningWorker.close(),
      renewalWorker.close(),
      webhookWorker.close(),
    ]);
    
    logger.info('All workers closed');
    
    // Close database connection
    await prisma.$disconnect();
    logger.info('Database disconnected');
    
    // Close redis connection
    await redis.quit();
    logger.info('Redis disconnected');
    
    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
}

/**
 * Start all workers
 */
async function startWorkers() {
  logger.info('Starting billing system workers...', {
    nodeEnv: config.app.env,
    workerVersion: '1.0.0',
  });
  
  // Verify connections before starting
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection verified');
    
    await redis.ping();
    logger.info('Redis connection verified');
  } catch (error) {
    logger.error('Failed to verify connections', { error: error.message });
    process.exit(1);
  }
  
  // Start health check server
  const healthServer = startHealthServer();
  
  // Log worker registrations
  logger.info('Workers registered:', {
    recognition: recognitionWorker.name,
    dunning: dunningWorker.name,
    renewal: renewalWorker.name,
    webhook: webhookWorker.name,
  });
  
  // Schedule recurring jobs
  await scheduleRecurringJobs();
  
  // Log queue metrics periodically (every 5 minutes)
  setInterval(async () => {
    const metrics = {
      recognition: await getQueueMetrics(recognitionQueue),
      dunning: await getQueueMetrics(dunningQueue),
      renewal: await getQueueMetrics(renewalQueue),
      webhook: await getQueueMetrics(webhookQueue),
    };
    
    logger.debug('Queue metrics', metrics);
  }, 5 * 60 * 1000);
  
  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  logger.info('All workers started successfully');
  logger.info(`Health check available at http://localhost:${WORKER_PORT}/health`);
}

// Start the workers
startWorkers().catch((error) => {
  logger.error('Failed to start workers', { error: error.message, stack: error.stack });
  process.exit(1);
});