import express from 'express';
import {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getBillingInfo,
  updateBillingInfo,
  getSubscriptions,
  getInvoices,
  getPayments,
} from './customers.controller.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
  updateBillingInfoSchema,
  listCustomersSchema,
} from './customers.schema.js';
import validateMiddleware from '../../middleware/validate.middleware.js';
import authMiddleware from '../../middleware/auth.middleware.js';
import tenantMiddleware from '../../middleware/tenant.middleware.js';

const router = express.Router();

// All customer routes require auth and tenant context
router.use(authMiddleware, tenantMiddleware);

/**
 * @route GET /api/v1/customers
 * @desc List customers with pagination and filters
 * @access Private
 */
router.get(
  '/',
  validateMiddleware({ query: listCustomersSchema }),
  listCustomers
);

/**
 * @route POST /api/v1/customers
 * @desc Create a new customer
 * @access Private
 */
router.post(
  '/',
  validateMiddleware({ body: createCustomerSchema }),
  createCustomer
);

/**
 * @route GET /api/v1/customers/:id
 * @desc Get customer by ID
 * @access Private
 */
router.get('/:id', getCustomerById);

/**
 * @route PATCH /api/v1/customers/:id
 * @desc Update customer
 * @access Private
 */
router.patch(
  '/:id',
  validateMiddleware({ body: updateCustomerSchema }),
  updateCustomer
);

/**
 * @route DELETE /api/v1/customers/:id
 * @desc Soft delete customer
 * @access Private
 */
router.delete('/:id', deleteCustomer);

/**
 * @route GET /api/v1/customers/:id/billing-info
 * @desc Get customer billing info
 * @access Private
 */
router.get('/:id/billing-info', getBillingInfo);

/**
 * @route PATCH /api/v1/customers/:id/billing-info
 * @desc Update customer billing info
 * @access Private
 */
router.patch(
  '/:id/billing-info',
  validateMiddleware({ body: updateBillingInfoSchema }),
  updateBillingInfo
);

/**
 * @route GET /api/v1/customers/:id/subscriptions
 * @desc Get customer subscriptions
 * @access Private
 */
router.get('/:id/subscriptions', getSubscriptions);

/**
 * @route GET /api/v1/customers/:id/invoices
 * @desc Get customer invoices
 * @access Private
 */
router.get('/:id/invoices', getInvoices);

/**
 * @route GET /api/v1/customers/:id/payments
 * @desc Get customer payments
 * @access Private
 */
router.get('/:id/payments', getPayments);

export default router;