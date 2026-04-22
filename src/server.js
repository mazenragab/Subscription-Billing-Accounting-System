/**
 * Server Entry Point
 * 
 * Creates HTTP server, connects to database and Redis,
 * and starts listening for requests.
 * 
 * Handles graceful shutdown on SIGTERM and SIGINT.
 */

import http from 'http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import logger from './shared/utils/logger.js';
import config from './config/env.js';

// Server instance reference for graceful shutdown
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
    // ============================================================
    // Connect to Database
    // ============================================================
    logger.info('Connecting to database...');
    await connectDatabase();
    logger.info('Database connected successfully');

    // ============================================================
    // Connect to Redis
    // ============================================================
    logger.info('Connecting to Redis...');
    await connectRedis();
    logger.info('Redis connected successfully');

    // ============================================================
    // Create Express app and HTTP server
    // ============================================================
    const app = createApp();
    
    server = http.createServer(app);

    // ============================================================
    // Start listening
    // ============================================================
    const port = config.app.port || 3000;
    const host = config.app.isProduction ? '0.0.0.0' : 'localhost';
    
    server.listen(port, host, () => {
      const startupTime = Date.now() - startTime;
      logger.info(`Server started successfully`, {
        host,
        port,
        environment: config.app.env,
        startupTimeMs: startupTime,
        memoryUsage: process.memoryUsage(),
      });
      
      // Log available endpoints summary
      logEndpointSummary();
    });

    // ============================================================
    // Server error handling
    // ============================================================
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use. Please free the port or use a different port.`);
        process.exit(1);
      } else {
        logger.error('Server error', { error: error.message, stack: error.stack });
        process.exit(1);
      }
    });

    // ============================================================
    // Graceful shutdown handlers
    // ============================================================
    setupGracefulShutdown();

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown() {
  const shutdownSignals = ['SIGTERM', 'SIGINT'];
  
  for (const signal of shutdownSignals) {
    process.on(signal, () => {
      gracefulShutdown(signal);
    });
  }
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack,
    });
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
    });
    gracefulShutdown('UNHANDLED_REJECTION');
  });
}

/**
 * Gracefully shutdown the server
 * @param {string} signal - Signal that triggered shutdown
 */
async function gracefulShutdown(signal) {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring duplicate signal');
    return;
  }
  
  isShuttingDown = true;
  
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  // Set timeout for force shutdown
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout (30s), forcing exit');
    process.exit(1);
  }, 30000);
  
  try {
    // Stop accepting new requests
    if (server) {
      logger.info('Closing HTTP server...');
      await new Promise((resolve) => {
        server.close(resolve);
      });
      logger.info('HTTP server closed');
    }
    
    // Close database connection
    logger.info('Disconnecting from database...');
    await disconnectDatabase();
    logger.info('Database disconnected');
    
    // Close Redis connection
    logger.info('Disconnecting from Redis...');
    await disconnectRedis();
    logger.info('Redis disconnected');
    
    clearTimeout(forceShutdownTimeout);
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

/**
 * Log endpoint summary for the running server
 */
function logEndpointSummary() {
  const endpoints = [
    { method: 'GET', path: '/health', description: 'Health check' },
    { method: 'POST', path: '/api/v1/auth/register', description: 'Register new organization' },
    { method: 'POST', path: '/api/v1/auth/login', description: 'Login' },
    { method: 'POST', path: '/api/v1/auth/refresh', description: 'Refresh token' },
    { method: 'POST', path: '/api/v1/auth/logout', description: 'Logout' },
    { method: 'GET', path: '/api/v1/auth/me', description: 'Get current user' },
    { method: 'GET', path: '/api/v1/organizations/current', description: 'Get organization' },
    { method: 'PATCH', path: '/api/v1/organizations/current', description: 'Update organization' },
    { method: 'GET', path: '/api/v1/organizations/current/billing-settings', description: 'Get billing settings' },
    { method: 'PATCH', path: '/api/v1/organizations/current/billing-settings', description: 'Update billing settings' },
    { method: 'GET', path: '/api/v1/organizations/current/members', description: 'Get organization members' },
    { method: 'POST', path: '/api/v1/organizations/current/members', description: 'Invite user' },
    { method: 'DELETE', path: '/api/v1/organizations/current/members/:userId', description: 'Remove member' },
    { method: 'GET', path: '/api/v1/customers', description: 'List customers' },
    { method: 'POST', path: '/api/v1/customers', description: 'Create customer' },
    { method: 'GET', path: '/api/v1/customers/:id', description: 'Get customer' },
    { method: 'PATCH', path: '/api/v1/customers/:id', description: 'Update customer' },
    { method: 'DELETE', path: '/api/v1/customers/:id', description: 'Delete customer' },
    { method: 'GET', path: '/api/v1/plans', description: 'List plans' },
    { method: 'POST', path: '/api/v1/plans', description: 'Create plan' },
    { method: 'GET', path: '/api/v1/plans/:id', description: 'Get plan' },
    { method: 'PATCH', path: '/api/v1/plans/:id', description: 'Update plan' },
    { method: 'DELETE', path: '/api/v1/plans/:id', description: 'Delete plan' },
    { method: 'GET', path: '/api/v1/subscriptions', description: 'List subscriptions' },
    { method: 'POST', path: '/api/v1/subscriptions', description: 'Create subscription' },
    { method: 'GET', path: '/api/v1/subscriptions/:id', description: 'Get subscription' },
    { method: 'POST', path: '/api/v1/subscriptions/:id/cancel', description: 'Cancel subscription' },
    { method: 'POST', path: '/api/v1/subscriptions/:id/pause', description: 'Pause subscription' },
    { method: 'POST', path: '/api/v1/subscriptions/:id/resume', description: 'Resume subscription' },
    { method: 'POST', path: '/api/v1/subscriptions/:id/upgrade', description: 'Upgrade plan' },
    { method: 'POST', path: '/api/v1/subscriptions/:id/downgrade', description: 'Downgrade plan' },
    { method: 'POST', path: '/api/v1/subscriptions/:id/apply-discount', description: 'Apply discount' },
    { method: 'POST', path: '/api/v1/billing/run-monthly-invoices', description: 'Run monthly invoice generation' },
    { method: 'GET', path: '/api/v1/invoices', description: 'List invoices' },
    { method: 'POST', path: '/api/v1/invoices', description: 'Create draft invoice' },
    { method: 'GET', path: '/api/v1/invoices/:id', description: 'Get invoice' },
    { method: 'POST', path: '/api/v1/invoices/:id/issue', description: 'Issue invoice' },
    { method: 'POST', path: '/api/v1/invoices/:id/void', description: 'Void invoice' },
    { method: 'POST', path: '/api/v1/invoices/:id/payments', description: 'Record payment' },
    { method: 'GET', path: '/api/v1/payments', description: 'List payments' },
    { method: 'GET', path: '/api/v1/discount-codes', description: 'List discount codes' },
    { method: 'POST', path: '/api/v1/discount-codes', description: 'Create discount code' },
    { method: 'GET', path: '/api/v1/reports/income-statement', description: 'Income statement' },
    { method: 'GET', path: '/api/v1/reports/balance-sheet', description: 'Balance sheet' },
    { method: 'GET', path: '/api/v1/reports/ar-aging', description: 'AR aging' },
    { method: 'GET', path: '/api/v1/reports/mrr', description: 'MRR report' },
    { method: 'GET', path: '/api/v1/reports/churn', description: 'Churn report' },
    { method: 'POST', path: '/api/v1/accounting/recognize-revenue', description: 'Run revenue recognition for period' },
    { method: 'POST', path: '/api/v1/reports/revenue-recognition/run', description: 'Legacy recognition trigger route' },
  ];
  
  logger.info('Available endpoints:', { endpoints: endpoints.length });
  
  // In development, log detailed endpoints
  if (config.app.isDevelopment) {
    for (const endpoint of endpoints) {
      logger.debug(`  ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);
    }
  }
}

/**
 * Handle process events for container environments (Docker, Kubernetes)
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
});

process.on('SIGINT', () => {
  logger.info('SIGINT received');
});

// Start the server
startServer();
