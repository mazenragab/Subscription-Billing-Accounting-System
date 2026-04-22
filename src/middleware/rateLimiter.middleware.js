import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../config/redis.js';
import config from '../config/env.js';

/**
 * General rate limiter for all API endpoints.
 * Uses Redis store for distributed rate limiting across multiple instances.
 */
const generalRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rl:general:',
  }),
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    message: `Rate limit exceeded. Please try again later.`,
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use tenant ID if available, otherwise IP address
    return req.tenantId || req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for health check endpoint
    return req.path === '/health';
  },
});

/**
 * Stricter rate limiter for authentication endpoints.
 * Prevents brute force attacks on login/register.
 */
const authRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rl:auth:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.rateLimit.authMaxRequests || 20,
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use email from body or IP address
    return req.body?.email || req.ip;
  },
});

/**
 * Rate limiter for idempotent operations (payments).
 * Prevents replay attacks while allowing legitimate retries.
 */
const idempotencyRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rl:idempotent:',
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Max 10 unique idempotency keys per hour
  message: {
    error: 'Too many idempotent requests',
    code: 'IDEMPOTENCY_RATE_LIMIT_EXCEEDED',
    message: 'Too many unique idempotency keys. Please wait before retrying.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use tenant ID + idempotency key prefix
    return `${req.tenantId || req.ip}:${req.body?.idempotency_key?.slice(0, 8) || 'unknown'}`;
  },
});

export {
  generalRateLimiter,
  authRateLimiter,
  idempotencyRateLimiter,
};