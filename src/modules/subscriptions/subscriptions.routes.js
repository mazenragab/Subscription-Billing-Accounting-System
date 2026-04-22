import express from 'express';
import {
  listSubscriptions,
  getSubscription,
  createSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  upgradeSubscription,
  downgradeSubscription,
  applyDiscountToSubscription,
  getSubscriptionHistory,
  runMonthlyInvoicing,
} from './subscriptions.controller.js';
import {
  createSubscriptionSchema,
  cancelSubscriptionSchema,
  changePlanSchema,
  applyDiscountSchema,
  listSubscriptionsSchema,
  runMonthlyInvoicingSchema,
} from './subscriptions.schema.js';
import validateMiddleware from '../../middleware/validate.middleware.js';
import authMiddleware from '../../middleware/auth.middleware.js';
import tenantMiddleware from '../../middleware/tenant.middleware.js';

const router = express.Router();

// All subscription routes require auth and tenant context
router.use(authMiddleware, tenantMiddleware);

/**
 * @route GET /api/v1/subscriptions
 * @desc List subscriptions with pagination and filters
 * @access Private
 */
router.get(
  '/',
  validateMiddleware({ query: listSubscriptionsSchema }),
  listSubscriptions
);

/**
 * @route POST /api/v1/subscriptions/run-monthly-invoicing
 * @desc Run monthly invoicing simulation (manual cron trigger)
 * @access Private
 */
router.post(
  '/run-monthly-invoicing',
  validateMiddleware({ body: runMonthlyInvoicingSchema }),
  runMonthlyInvoicing
);

/**
 * @route POST /api/v1/subscriptions
 * @desc Create a new subscription
 * @access Private
 */
router.post(
  '/',
  validateMiddleware({ body: createSubscriptionSchema }),
  createSubscription
);

/**
 * @route GET /api/v1/subscriptions/:id
 * @desc Get subscription by ID
 * @access Private
 */
router.get('/:id', getSubscription);

/**
 * @route GET /api/v1/subscriptions/:id/history
 * @desc Get subscription status history
 * @access Private
 */
router.get('/:id/history', getSubscriptionHistory);

/**
 * @route POST /api/v1/subscriptions/:id/cancel
 * @desc Cancel subscription (immediate or at period end)
 * @access Private
 */
router.post(
  '/:id/cancel',
  validateMiddleware({ body: cancelSubscriptionSchema }),
  cancelSubscription
);

/**
 * @route POST /api/v1/subscriptions/:id/pause
 * @desc Pause subscription
 * @access Private
 */
router.post('/:id/pause', pauseSubscription);

/**
 * @route POST /api/v1/subscriptions/:id/resume
 * @desc Resume subscription
 * @access Private
 */
router.post('/:id/resume', resumeSubscription);

/**
 * @route POST /api/v1/subscriptions/:id/upgrade
 * @desc Upgrade plan (immediate with proration)
 * @access Private
 */
router.post(
  '/:id/upgrade',
  validateMiddleware({ body: changePlanSchema }),
  upgradeSubscription
);

/**
 * @route POST /api/v1/subscriptions/:id/downgrade
 * @desc Downgrade plan (at period end)
 * @access Private
 */
router.post(
  '/:id/downgrade',
  validateMiddleware({ body: changePlanSchema }),
  downgradeSubscription
);

/**
 * @route POST /api/v1/subscriptions/:id/apply-discount
 * @desc Apply discount code to subscription
 * @access Private
 */
router.post(
  '/:id/apply-discount',
  validateMiddleware({ body: applyDiscountSchema }),
  applyDiscountToSubscription
);

export default router;
