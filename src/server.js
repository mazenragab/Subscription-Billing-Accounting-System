/**
 * Server Entry Point – Compatible with both traditional hosting and Vercel serverless.
 *
 * - When running on Vercel (process.env.VERCEL = '1'), the app is exported as a serverless function.
 * - When running locally or on a traditional server, it starts an HTTP server.
 */

import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import logger from './shared/utils/logger.js';
import config from './config/env.js';

// Create the Express application
const app = createApp();

// Only start the HTTP server if NOT running on Vercel
if (!process.env.VERCEL) {
  let server = null;
  let isShuttingDown = false;

  /**
   * Initialize and start the server
   */
  async function startServer() {
    const startTime = Date.now();
    logger.info('Starting billing system...', {
      environment: config.app.env,
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
    });

    try {
      // Connect to Database
      logger.info('Connecting to database...');
      await connectDatabase();
      logger.info('Database connected successfully');

      // Connect to Redis
      logger.info('Connecting to Redis...');
      await connectRedis();
      logger.info('Redis connected successfully');

      // Start HTTP server
      const port = config.app.port || 3000;
      const host = config.app.isProduction ? '0.0.0.0' : 'localhost';
      server = app.listen(port, host, () => {
        const startupTime = Date.now() - startTime;
        logger.info(`Server started successfully`, {
          host,
          port,
          environment: config.app.env,
          startupTimeMs: startupTime,
          memoryUsage: process.memoryUsage(),
        });
        logEndpointSummary();
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${port} is already in use.`);
        } else {
          logger.error('Server error', { error: error.message });
        }
        process.exit(1);
      });

      setupGracefulShutdown();
    } catch (error) {
      logger.error('Failed to start server', { error: error.message });
      process.exit(1);
    }
  }

  function setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT'];
    for (const signal of signals) {
      process.on(signal, () => gracefulShutdown(signal));
    }
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message });
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason: reason?.message });
      gracefulShutdown('UNHANDLED_REJECTION');
    });
  }

  async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    const forceTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout (30s), forcing exit');
      process.exit(1);
    }, 30000);

    try {
      if (server) {
        logger.info('Closing HTTP server...');
        await new Promise((resolve) => server.close(resolve));
        logger.info('HTTP server closed');
      }
      await disconnectDatabase();
      await disconnectRedis();
      clearTimeout(forceTimeout);
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', { error: error.message });
      process.exit(1);
    }
  }

  function logEndpointSummary() {
    const endpoints = [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'POST', path: '/api/v1/auth/register', description: 'Register new organization' },
      // ... (keep your existing endpoint list)
    ];
    logger.info('Available endpoints:', { endpoints: endpoints.length });
    if (config.app.isDevelopment) {
      for (const endpoint of endpoints) {
        logger.debug(`  ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);
      }
    }
  }

  // Start the server (only when not on Vercel)
  startServer();
}

// Export the Express app for Vercel serverless functions
export default app;