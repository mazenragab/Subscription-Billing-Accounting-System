import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the correct .env file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// ─── Validation helpers ────────────────────────────────────────────────────

const errors = [];

/**
 * @param {string} name - env variable name
 * @param {string} [defaultValue] - optional default (only for non-required vars)
 * @param {boolean} [required=true]
 * @returns {string}
 */
function get(name, defaultValue = undefined, required = true) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    if (required && defaultValue === undefined) {
      errors.push(`  ✗ ${name} is required but not set`);
      return '';
    }
    return defaultValue || '';
  }
  return value.trim();
}

/**
 * @param {string} name
 * @param {number} defaultValue
 * @param {boolean} [required=false]
 * @returns {number}
 */
function getInt(name, defaultValue, required = false) {
  const raw = get(name, String(defaultValue), required);
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    errors.push(`  ✗ ${name} must be an integer, got: "${raw}"`);
    return defaultValue;
  }
  return parsed;
}

/**
 * @param {string} name
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
function getBool(name, defaultValue) {
  const raw = get(name, String(defaultValue), false);
  return raw === 'true' || raw === '1';
}

// ─── Config object ─────────────────────────────────────────────────────────

const config = {
  app: {
    env: get('NODE_ENV', 'development', false),
    port: getInt('PORT', 3000),
    logLevel: get('LOG_LEVEL', 'info', false),
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
    isDevelopment: process.env.NODE_ENV === 'development',
  },

  database: {
    url: get('DATABASE_URL'),
  },

  redis: {
    url: get('REDIS_URL'),
  },

  auth: {
    jwtSecret: get('JWT_SECRET'),
    jwtExpiresIn: get('JWT_EXPIRES_IN', '15m', false),
    refreshTokenExpiresIn: get('REFRESH_TOKEN_EXPIRES_IN', '7d', false),
    bcryptRounds: getInt('BCRYPT_ROUNDS', 12),
  },

  billing: {
    recognitionCron: get('RECOGNITION_CRON', '0 2 1 * *', false),
    recognitionBatchSize: getInt('RECOGNITION_BATCH_SIZE', 100),
    dunningRetryDays: get('DUNNING_RETRY_DAYS', '3,7,14', false)
      .split(',')
      .map(d => parseInt(d.trim(), 10))
      .filter(d => !isNaN(d)),
    dunningEnabled: getBool('DUNNING_ENABLED', true),
  },

  webhooks: {
    maxAttempts: getInt('WEBHOOK_MAX_ATTEMPTS', 3),
    timeoutMs: getInt('WEBHOOK_TIMEOUT_MS', 5000),
    signingSecret: get('WEBHOOK_SIGNING_SECRET'),
  },

  rateLimit: {
    windowMs: getInt('RATE_LIMIT_WINDOW_MS', 60000),
    maxRequests: getInt('RATE_LIMIT_MAX_REQUESTS', 100),
    authMaxRequests: getInt('AUTH_RATE_LIMIT_MAX', 20),
  },

  pagination: {
    defaultPageSize: getInt('DEFAULT_PAGE_SIZE', 20),
    maxPageSize: getInt('MAX_PAGE_SIZE', 100),
  },
};

// ─── Validate JWT secret length ────────────────────────────────────────────
if (config.auth.jwtSecret && config.auth.jwtSecret.length < 32) {
  errors.push(`  ✗ JWT_SECRET must be at least 32 characters (got ${config.auth.jwtSecret.length})`);
}

// ─── Throw on any missing variables ───────────────────────────────────────
if (errors.length > 0) {
  console.error('\n❌  Environment validation failed:\n');
  errors.forEach(e => console.error(e));
  console.error('\nFix the above variables in your .env file and restart.\n');
  process.exit(1);
}

export default config;