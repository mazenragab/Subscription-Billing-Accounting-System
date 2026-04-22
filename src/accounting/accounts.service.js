import { prisma } from '../config/database.js';
import redis from '../config/redis.js';
import logger from '../shared/utils/logger.js';
import { NotFoundError, AccountingError } from '../shared/errors/index.js';
import { ACCOUNT_CODES } from './accounting.constants.js';

const CACHE_TTL = 300; // 5 minutes
const CACHE_KEY_PREFIX = 'account:';

/**
 * Get account by code with Redis caching
 * @param {string} organizationId - Organization ID
 * @param {string} accountCode - Account code (e.g., '1100')
 * @returns {Promise<Object>} Account object
 */
export async function getAccountByCode(organizationId, accountCode) {
  const cacheKey = `${CACHE_KEY_PREFIX}${organizationId}:${accountCode}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Query database
  const account = await prisma.chartOfAccount.findFirst({
    where: {
      organization_id: organizationId,
      code: accountCode,
      is_active: true,
    },
  });
  
  if (!account) {
    throw new NotFoundError(`Account with code ${accountCode}`);
  }
  
  // Cache the result
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(account));
  
  return account;
}

/**
 * Get multiple accounts by codes
 * @param {string} organizationId - Organization ID
 * @param {string[]} accountCodes - Array of account codes
 * @returns {Promise<Object[]>} Array of account objects
 */
export async function getAccountsByCodes(organizationId, accountCodes) {
  const accounts = await prisma.chartOfAccount.findMany({
    where: {
      organization_id: organizationId,
      code: { in: accountCodes },
      is_active: true,
    },
  });
  
  const accountMap = new Map();
  accounts.forEach(account => {
    accountMap.set(account.code, account);
  });
  
  // Check if all accounts were found
  const missingCodes = accountCodes.filter(code => !accountMap.has(code));
  if (missingCodes.length > 0) {
    throw new NotFoundError(`Accounts with codes: ${missingCodes.join(', ')}`);
  }
  
  return accounts;
}

/**
 * Get account by ID
 * @param {string} organizationId - Organization ID
 * @param {string} accountId - Account ID
 * @returns {Promise<Object>} Account object
 */
export async function getAccountById(organizationId, accountId) {
  const account = await prisma.chartOfAccount.findFirst({
    where: {
      id: accountId,
      organization_id: organizationId,
      is_active: true,
    },
  });
  
  if (!account) {
    throw new NotFoundError('Account');
  }
  
  return account;
}

/**
 * Get all accounts for an organization
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object[]>} Array of accounts
 */
export async function getAllAccounts(organizationId) {
  return await prisma.chartOfAccount.findMany({
    where: {
      organization_id: organizationId,
      is_active: true,
    },
    orderBy: { code: 'asc' },
  });
}

/**
 * Get accounts by type
 * @param {string} organizationId - Organization ID
 * @param {string} accountType - Account type (ASSET, LIABILITY, etc.)
 * @returns {Promise<Object[]>} Array of accounts
 */
export async function getAccountsByType(organizationId, accountType) {
  return await prisma.chartOfAccount.findMany({
    where: {
      organization_id: organizationId,
      type: accountType,
      is_active: true,
    },
    orderBy: { code: 'asc' },
  });
}

/**
 * Create a custom account (non-system)
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Account data
 * @returns {Promise<Object>} Created account
 */
export async function createCustomAccount(organizationId, data) {
  const existing = await prisma.chartOfAccount.findFirst({
    where: {
      organization_id: organizationId,
      code: data.code,
    },
  });
  
  if (existing) {
    throw new AccountingError(`Account with code ${data.code} already exists`, [
      { field: 'code', message: 'Account code must be unique' }
    ]);
  }
  
  const account = await prisma.chartOfAccount.create({
    data: {
      organization_id: organizationId,
      code: data.code,
      name: data.name,
      type: data.type,
      normal_balance: data.normal_balance,
      is_system: false,
      is_active: true,
      description: data.description,
    },
  });
  
  // Invalidate cache for this organization
  await invalidateAccountCache(organizationId);
  
  logger.info('Custom account created', {
    organizationId,
    accountCode: account.code,
    accountName: account.name,
  });
  
  return account;
}

/**
 * Update an account
 * @param {string} organizationId - Organization ID
 * @param {string} accountId - Account ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated account
 */
export async function updateAccount(organizationId, accountId, data) {
  const account = await getAccountById(organizationId, accountId);
  
  if (account.is_system && data.is_active === false) {
    throw new AccountingError('Cannot deactivate system account', [
      { field: 'is_active', message: 'System accounts cannot be deactivated' }
    ]);
  }
  
  const updated = await prisma.chartOfAccount.update({
    where: { id: accountId },
    data: {
      name: data.name,
      description: data.description,
      is_active: data.is_active !== undefined ? data.is_active : account.is_active,
    },
  });
  
  // Invalidate cache
  await invalidateAccountCache(organizationId);
  await redis.del(`${CACHE_KEY_PREFIX}${organizationId}:${account.code}`);
  
  logger.info('Account updated', {
    organizationId,
    accountId,
    accountCode: account.code,
  });
  
  return updated;
}

/**
 * Invalidate all account caches for an organization
 * @param {string} organizationId - Organization ID
 */
async function invalidateAccountCache(organizationId) {
  const keys = await redis.keys(`${CACHE_KEY_PREFIX}${organizationId}:*`);
  if (keys.length > 0) {
    await redis.del(keys);
  }
}

/**
 * Seed system accounts for a new organization
 * @param {string} organizationId - Organization ID
 * @param {Object} tx - Prisma transaction client
 * @returns {Promise<Object[]>} Created accounts
 */
export async function seedSystemAccounts(organizationId, tx) {
  const accounts = [];
  
  for (const accountData of SYSTEM_ACCOUNTS) {
    const account = await tx.chartOfAccount.create({
      data: {
        organization_id: organizationId,
        code: accountData.code,
        name: accountData.name,
        type: accountData.type,
        normal_balance: accountData.normal_balance,
        is_system: true,
        is_active: true,
        description: accountData.description,
      },
    });
    accounts.push(account);
  }
  
  logger.info('System accounts seeded', {
    organizationId,
    accountCount: accounts.length,
  });
  
  return accounts;
}

/**
 * Verify accounts exist and are active
 * @param {string} organizationId - Organization ID
 * @param {Array<{accountCode: string}>} lines - Journal entry lines
 * @returns {Promise<Map>} Map of account codes to account objects
 */
export async function verifyAccounts(organizationId, lines) {
  const accountCodes = [...new Set(lines.map(l => l.accountCode))];
  const accounts = await getAccountsByCodes(organizationId, accountCodes);
  
  const accountMap = new Map();
  accounts.forEach(account => {
    accountMap.set(account.code, account);
  });
  
  // Verify all accounts are active
  for (const account of accounts) {
    if (!account.is_active) {
      throw new AccountingError(`Account ${account.code} is inactive`, [
        { field: 'accountCode', message: `Account ${account.code} is not active` }
      ]);
    }
  }
  
  return accountMap;
}

export default {
  getAccountByCode,
  getAccountsByCodes,
  getAccountById,
  getAllAccounts,
  getAccountsByType,
  createCustomAccount,
  updateAccount,
  seedSystemAccounts,
  verifyAccounts,
};