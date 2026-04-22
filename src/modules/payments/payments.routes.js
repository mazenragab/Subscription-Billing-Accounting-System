import express from 'express';
import {
  processPaymentController,
  getPayment,
  listPayments,
  getCustomerPaymentSummary,
  getPaymentStats,
  savePaymentMethod,
  getCustomerPaymentMethods,
  deletePaymentMethod,
  getPaymentAttempts,
  paymentWebhook,
} from './payments.controller.js';
import {
  recordPaymentSchema,
  listPaymentsSchema,
  savePaymentMethodSchema,
} from './payments.schema.js';
import validateMiddleware from '../../middleware/validate.middleware.js';
import authMiddleware from '../../middleware/auth.middleware.js';
import tenantMiddleware from '../../middleware/tenant.middleware.js';
import { idempotencyRateLimiter } from '../../middleware/rateLimiter.middleware.js';
import { requireRoles } from '../../middleware/role.middleware.js';

const router = express.Router();

// All payment routes require auth and tenant context
router.use(authMiddleware, tenantMiddleware);

/**
 * @route GET /api/v1/payments
 * @desc List payments with pagination and filters
 * @access Private
 */
router.get(
  '/',
  validateMiddleware({ query: listPaymentsSchema }),
  listPayments
);

/**
 * @route GET /api/v1/payments/stats
 * @desc Get payment statistics
 * @access Private
 */
router.get('/stats', getPaymentStats);

/**
 * @route POST /api/v1/payments/webhook
 * @desc Simulate payment webhook (testing)
 * @access Private
 */
router.post('/webhook', requireRoles(['OWNER', 'ADMIN', 'BILLING_MANAGER']), paymentWebhook);

/**
 * @route GET /api/v1/customers/:customerId/payments/summary
 * @desc Get customer payment summary
 * @access Private
 */
router.get('/customers/:customerId/payments/summary', getCustomerPaymentSummary);

/**
 * @route GET /api/v1/customers/:customerId/payment-methods
 * @desc Get customer payment methods
 * @access Private
 */
router.get('/customers/:customerId/payment-methods', getCustomerPaymentMethods);

/**
 * @route POST /api/v1/customers/:customerId/payment-methods
 * @desc Save payment method for customer
 * @access Private
 */
router.post(
  '/customers/:customerId/payment-methods',
  requireRoles(['OWNER', 'ADMIN', 'BILLING_MANAGER']),
  validateMiddleware({ body: savePaymentMethodSchema }),
  savePaymentMethod
);

/**
 * @route DELETE /api/v1/customers/:customerId/payment-methods/:paymentMethodId
 * @desc Delete payment method
 * @access Private
 */
router.delete(
  '/customers/:customerId/payment-methods/:paymentMethodId',
  requireRoles(['OWNER', 'ADMIN', 'BILLING_MANAGER']),
  deletePaymentMethod
);

/**
 * @route GET /api/v1/invoices/:invoiceId/payment-attempts
 * @desc Get payment attempts for invoice
 * @access Private
 */
router.get('/invoices/:invoiceId/payment-attempts', getPaymentAttempts);

/**
 * @route POST /api/v1/invoices/:invoiceId/payments
 * @desc Process payment for invoice (with idempotency)
 * @access Private
 */
router.post(
  '/invoices/:invoiceId/payments',
  requireRoles(['OWNER', 'ADMIN', 'BILLING_MANAGER']),
  idempotencyRateLimiter,
  validateMiddleware({ body: recordPaymentSchema }),
  processPaymentController
);

/**
 * @route GET /api/v1/payments/:paymentId
 * @desc Get payment by ID
 * @access Private
 */
router.get('/:paymentId', getPayment);

export default router;
