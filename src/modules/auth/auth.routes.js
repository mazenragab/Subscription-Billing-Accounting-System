import express from 'express';
import { 
  register, 
  login, 
  logout, 
  refreshToken, 
  getCurrentUser, 
  changePassword,
  forgotPassword,
  resetPassword,
} from './auth.controller.js';
import { 
  registerSchema, 
  loginSchema, 
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema.js';
import validateMiddleware from '../../middleware/validate.middleware.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route POST /api/v1/auth/register
 * @desc Register new user and organization
 * @access Public
 */
router.post(
  '/register',
  validateMiddleware({ body: registerSchema }),
  register
);

/**
 * @route POST /api/v1/auth/login
 * @desc Login user
 * @access Public
 */
router.post(
  '/login',
  validateMiddleware({ body: loginSchema }),
  login
);

/**
 * @route POST /api/v1/auth/refresh
 * @desc Refresh access token
 * @access Public (with valid refresh token)
 */
router.post(
  '/refresh',
  validateMiddleware({ body: refreshTokenSchema }),
  refreshToken
);

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post(
  '/logout',
  authMiddleware,
  logout
);

/**
 * @route GET /api/v1/auth/me
 * @desc Get current user info
 * @access Private
 */
router.get(
  '/me',
  authMiddleware,
  getCurrentUser
);

/**
 * @route POST /api/v1/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.post(
  '/change-password',
  authMiddleware,
  validateMiddleware({ body: changePasswordSchema }),
  changePassword
);

/**
 * @route POST /api/v1/auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
router.post(
  '/forgot-password',
  validateMiddleware({ body: forgotPasswordSchema }),
  forgotPassword
);

/**
 * @route POST /api/v1/auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
router.post(
  '/reset-password',
  validateMiddleware({ body: resetPasswordSchema }),
  resetPassword
);

export default router;