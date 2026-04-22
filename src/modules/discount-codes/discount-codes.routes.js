import express from 'express';
import {
  listDiscountCodes,
  getDiscountCodeById,
  validateDiscountCode,
  createDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
  getDiscountCodeStatsController,
} from './discount-codes.controller.js';
import {
  createDiscountCodeSchema,
  updateDiscountCodeSchema,
  listDiscountCodesSchema,
} from './discount-codes.schema.js';
import validateMiddleware from '../../middleware/validate.middleware.js';
import authMiddleware from '../../middleware/auth.middleware.js';
import tenantMiddleware from '../../middleware/tenant.middleware.js';

const router = express.Router();

// All discount code routes require auth and tenant context
router.use(authMiddleware, tenantMiddleware);

/**
 * @route GET /api/v1/discount-codes
 * @desc List discount codes with pagination and filters
 * @access Private
 */
router.get(
  '/',
  validateMiddleware({ query: listDiscountCodesSchema }),
  listDiscountCodes
);

/**
 * @route GET /api/v1/discount-codes/stats
 * @desc Get discount code statistics
 * @access Private
 */
router.get('/stats', getDiscountCodeStatsController);

/**
 * @route GET /api/v1/discount-codes/validate/:code
 * @desc Validate a discount code
 * @access Private
 */
router.get('/validate/:code', validateDiscountCode);

/**
 * @route POST /api/v1/discount-codes
 * @desc Create a new discount code
 * @access Private (OWNER, ADMIN)
 */
router.post(
  '/',
  validateMiddleware({ body: createDiscountCodeSchema }),
  createDiscountCode
);

/**
 * @route GET /api/v1/discount-codes/:id
 * @desc Get discount code by ID
 * @access Private
 */
router.get('/:id', getDiscountCodeById);

/**
 * @route PATCH /api/v1/discount-codes/:id
 * @desc Update discount code
 * @access Private (OWNER, ADMIN)
 */
router.patch(
  '/:id',
  validateMiddleware({ body: updateDiscountCodeSchema }),
  updateDiscountCode
);

/**
 * @route DELETE /api/v1/discount-codes/:id
 * @desc Delete discount code (soft delete)
 * @access Private (OWNER, ADMIN)
 */
router.delete('/:id', deleteDiscountCode);

export default router;