import Redis from 'ioredis';
import config from './env.js';
import logger from '../shared/utils/logger.js';

/**
 * Redis client singleton — shared across rate limiter, BullMQ, and token blacklist.
 * Never instantiate Redis directly elsewhere — import from here.
 */

let redisInstance = null;
let connectionPromise = null;

function getRedisClient() {
  if (!redisInstance) {
    redisInstance = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,   // required by BullMQ
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis connection retry ${times}`, { delay });
        return delay;
      },
    });

    redisInstance.on('connect', () => logger.info('Redis connecting...'));
    redisInstance.on('ready', () => logger.info('Redis ready'));
    redisInstance.on('error', (err) => logger.error('Redis error', { error: err.message }));
    redisInstance.on('close', () => logger.warn('Redis connection closed'));
    redisInstance.on('reconnecting', () => logger.info('Redis reconnecting...'));
  }
  return redisInstance;
}

/**
 * Connect and verify Redis is reachable.
 * @returns {Promise<void>}
 */
export async function connectRedis() {
  // Prevent multiple simultaneous connection attempts
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      const client = getRedisClient();
      
      // Only connect if not already connecting/connected
      if (client.status === 'wait' || client.status === 'end') {
        await client.connect();
      }
      
      await client.ping();
      logger.info('Redis connection verified');
      return client;
    } catch (err) {
      connectionPromise = null;
      logger.error('Redis connection failed', { error: err.message });
      throw err;
    }
  })();

  return connectionPromise;
}

/**
 * Gracefully disconnect Redis.
 * @returns {Promise<void>}
 */
export async function disconnectRedis() {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
    connectionPromise = null;
    logger.info('Redis disconnected');
  }
}

// Create and export the redis client
const redis = getRedisClient();

export default redis;