import { createLogger, format, transports } from 'winston';

const { combine, timestamp, json, colorize, simple, errors } = format;

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Winston logger singleton.
 * - Production: JSON format to stdout (for log aggregators)
 * - Development: colored simple format for readability
 * - Test: silent (suppress noise during test runs, unless LOG_LEVEL=debug)
 */
const logger = createLogger({
  level: process.env.LOG_LEVEL || (isTest ? 'error' : 'info'),
  silent: isTest && process.env.LOG_LEVEL !== 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    isProduction ? json() : combine(colorize(), simple())
  ),
  transports: [
    new transports.Console(),
  ],
  // Never crash the process on logger errors
  exitOnError: false,
});

/**
 * Creates a child logger with fixed context fields.
 * Use this in modules to attach module-level metadata to all logs.
 *
 * @param {Object} context - e.g. { module: 'invoices', tenantId: '...' }
 * @returns {Object} child logger
 */
logger.child = (context) => {
  return {
    debug: (msg, meta = {}) => logger.debug(msg, { ...context, ...meta }),
    info: (msg, meta = {}) => logger.info(msg, { ...context, ...meta }),
    warn: (msg, meta = {}) => logger.warn(msg, { ...context, ...meta }),
    error: (msg, meta = {}) => logger.error(msg, { ...context, ...meta }),
  };
};

export default logger;