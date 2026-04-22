import { PrismaClient } from '@prisma/client';
import config from './env.js';
import logger from '../shared/utils/logger.js';

/**
 * Prisma client singleton.
 * One connection pool shared across the entire application.
 * Never instantiate PrismaClient elsewhere.
 */

const prismaOptions = {
  log: config.app.isDevelopment
    ? [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ]
    : [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
};

const prisma = new PrismaClient(prismaOptions);

// Log slow queries in development
if (config.app.isDevelopment) {
  prisma.$on('query', (e) => {
    if (e.duration > 100) {
      logger.warn('Slow query detected', {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
      });
    }
  });
}

prisma.$on('warn', (e) => {
  logger.warn('Prisma warning', { message: e.message });
});

prisma.$on('error', (e) => {
  logger.error('Prisma error', { message: e.message });
});

/**
 * Verify DB connection — called during server startup.
 * @returns {Promise<void>}
 */
export async function connectDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connected successfully');
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    throw err;
  }
}

/**
 * Gracefully disconnect Prisma — called on SIGTERM.
 * @returns {Promise<void>}
 */
export async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

export { prisma };