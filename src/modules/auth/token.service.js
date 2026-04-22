import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../../config/env.js';
import redis from '../../config/redis.js';
import logger from '../../shared/utils/logger.js';
import { UnauthorizedError } from '../../shared/errors/index.js';

const REFRESH_TOKEN_PREFIX = 'refresh_token:';
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes in seconds

/**
 * Token Service
 * Handles JWT access token and refresh token generation/validation
 */

/**
 * Generate access token
 * @param {Object} payload - Token payload
 * @returns {string} JWT access token
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn || '15m',
  });
}

/**
 * Generate refresh token (random string)
 * @returns {string} Refresh token
 */
export function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @param {Object} organization - Organization object
 * @param {string} role - User role in organization
 * @returns {Promise<Object>} Tokens
 */
export async function generateTokens(user, organization, role) {
  const payload = {
    userId: user.id,
    organizationId: organization.id,
    role: role,
    email: user.email,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken();

  // Store refresh token in Redis
  const refreshKey = `${REFRESH_TOKEN_PREFIX}${refreshToken}`;
  await redis.setex(
    refreshKey,
    REFRESH_TOKEN_TTL,
    JSON.stringify({
      userId: user.id,
      organizationId: organization.id,
      role: role,
    })
  );

  logger.info('Tokens generated', {
    userId: user.id,
    organizationId: organization.id,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL,
    tokenType: 'Bearer',
  };
}

/**
 * Verify access token
 * @param {string} token - JWT access token
 * @returns {Object} Decoded payload
 * @throws {UnauthorizedError}
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.auth.jwtSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Access token expired');
    }
    throw new UnauthorizedError('Invalid access token');
  }
}

/**
 * Verify refresh token and get stored data
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} Token data
 * @throws {UnauthorizedError}
 */
export async function verifyRefreshToken(refreshToken) {
  const refreshKey = `${REFRESH_TOKEN_PREFIX}${refreshToken}`;
  const data = await redis.get(refreshKey);

  if (!data) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  return JSON.parse(data);
}

/**
 * Revoke refresh token (logout)
 * @param {string} refreshToken - Refresh token to revoke
 * @returns {Promise<boolean>} Success status
 */
export async function revokeRefreshToken(refreshToken) {
  const refreshKey = `${REFRESH_TOKEN_PREFIX}${refreshToken}`;
  const result = await redis.del(refreshKey);
  
  logger.info('Refresh token revoked', { refreshToken: refreshToken.slice(0, 10) });
  return result > 0;
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of tokens revoked
 */
export async function revokeAllUserRefreshTokens(userId) {
  const pattern = `${REFRESH_TOKEN_PREFIX}*`;
  const keys = await redis.keys(pattern);
  
  let revoked = 0;
  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.userId === userId) {
        await redis.del(key);
        revoked++;
      }
    }
  }
  
  logger.info('All user refresh tokens revoked', { userId, revoked });
  return revoked;
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New tokens
 */
export async function refreshAccessToken(refreshToken) {
  const tokenData = await verifyRefreshToken(refreshToken);
  
  // Generate new tokens
  const newAccessToken = generateAccessToken({
    userId: tokenData.userId,
    organizationId: tokenData.organizationId,
    role: tokenData.role,
  });
  
  logger.info('Access token refreshed', {
    userId: tokenData.userId,
    organizationId: tokenData.organizationId,
  });
  
  return {
    accessToken: newAccessToken,
    refreshToken, // Keep same refresh token
    expiresIn: ACCESS_TOKEN_TTL,
    tokenType: 'Bearer',
  };
}

/**
 * Blacklist access token (for logout scenarios)
 * @param {string} accessToken - Access token to blacklist
 * @param {number} ttl - TTL in seconds
 * @returns {Promise<void>}
 */
export async function blacklistAccessToken(accessToken, ttl = ACCESS_TOKEN_TTL) {
  const decoded = jwt.decode(accessToken);
  if (decoded && decoded.exp) {
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    if (expiresIn > 0) {
      await redis.setex(`blacklist:${accessToken}`, expiresIn, 'true');
    }
  } else {
    await redis.setex(`blacklist:${accessToken}`, ttl, 'true');
  }
  
  logger.info('Access token blacklisted', { token: accessToken.slice(0, 20) });
}

/**
 * Check if access token is blacklisted
 * @param {string} accessToken - Access token to check
 * @returns {Promise<boolean>} Whether token is blacklisted
 */
export async function isAccessTokenBlacklisted(accessToken) {
  const result = await redis.get(`blacklist:${accessToken}`);
  return result !== null;
}

export default {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  refreshAccessToken,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
};