import express from 'express';
import {
  listInvoices,
  createDraftInvoice,
  getInvoice,
  issueInvoice,
  voidInvoice,
  markUncollectible,
  recordPayment,
  getInvoicePayments,
  getJournalEntries,
  getOrganizationPayments,
  getPayment,
} from './invoices.controller.js';
import {
  createInvoiceSchema,
  issueInvoiceSchema,
  recordPaymentSchema,
  listInvoicesSchema,
} from './invoices.schema.js';
import validateMiddleware from '../../middleware/validate.middleware.js';
import authMiddleware from '../../middleware/auth.middleware.js';
import tenantMiddleware from '../../middleware/tenant.middleware.js';
import { idempotencyRateLimiter } from '../../middleware/rateLimiter.middleware.js';
import { requireRoles } from '../../middleware/role.middleware.js';

const router = express.Router();

// All invoice routes require auth and tenant context
router.use(authMiddleware, tenantMiddleware);

/**
 * @route GET /api/v1/invoices
 * @desc List invoices with pagination and filters
 * @access Private
 */
router.get(
  '/',
  validateMiddleware({ query: listInvoicesSchema }),
  listInvoices
);

/**
 * @route POST /api/v1/invoices
 * @desc Create draft invoice
 * @access Private
 */
router.post(
  '/',
  requireRoles(['OWNER', 'ADMIN', 'BILLING_MANAGER']),
  validateMiddleware({ body: createInvoiceSchema }),
  createDraftInvoice
);

/**
 * @route GET /api/v1/invoices/payments
 * @desc Get organization-wide payments
 * @access Private
 */
router.get('/payments', getOrganizationPayments);

/**
 * @route GET /api/v1/invoices/payments/:paymentId
 * @desc Get payment by ID
 * @access Private
 */
router.get('/payments/:paymentId', getPayment);

/**
 * @route POST /api/v1/invoices/:id/issue
 * @desc Issue invoice (DRAFT -> ISSUED)
 * @access Private
 */
router.post(
  '/:id/issue',
  requireRoles(['OWNER', 'ADMIN', 'BILLING_MANAGER']),
  validateMiddleware({ body: issueInvoiceSchema }),
  issueInvoice
);

/**
 * @route POST /api/v1/invoices/:id/void
 * @desc Void invoice
 * @access Private
 */
router.post('/:id/void', requireRoles(['OWNER', 'ADMIN', 'BILLING_MANAGER']), voidInvoice);

/**
 * @route POST /api/v1/invoices/:id/mark-uncollectible
 * @desc Mark invoice as uncollectible
 * @access Private
 */
router.post(
  '/:id/mark-uncollectible',
  requireRoles(['OWNER', 'ADMIN', 'BILLING_MANAGER']),
  markUncollectible
);

/**
 * @route POST /api/v1/invoices/:id/payments
 * @desc Record payment for invoice (with idempotency)
 * @access Private
 */
router.post(
  '/:id/payments',
  requireRoles(['OWNER', 'ADMIN', 'BILLING_MANAGER']),
  idempotencyRateLimiter,
  validateMiddleware({ body: recordPaymentSchema }),
  recordPayment
);

/**
 * @route GET /api/v1/invoices/:id/payments
 * @desc Get invoice payments
 * @access Private
 */
router.get('/:id/payments', getInvoicePayments);

/**
 * @route GET /api/v1/invoices/:id/journal-entries
 * @desc Get invoice journal entries
 * @access Private
 */
router.get('/:id/journal-entries', getJournalEntries);

/**
 * @route GET /api/v1/invoices/:id
 * @desc Get invoice by ID
 * @access Private
 */
router.get('/:id', getInvoice);

export default router;
