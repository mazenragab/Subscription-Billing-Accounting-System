import express from 'express';
import { runMonthlyInvoices } from './billing.controller.js';
import { runMonthlyInvoicesSchema } from './billing.schema.js';
import validateMiddleware from '../../middleware/validate.middleware.js';
import authMiddleware from '../../middleware/auth.middleware.js';
import tenantMiddleware from '../../middleware/tenant.middleware.js';
import { requireRoles } from '../../middleware/role.middleware.js';

const router = express.Router();

router.use(authMiddleware, tenantMiddleware);

/**
 * @route POST /api/v1/billing/run-monthly-invoices
 * @desc Manual simulation for monthly invoice generation
 * @access Private
 */
router.post(
  '/run-monthly-invoices',
  requireRoles(['OWNER', 'ADMIN', 'BILLING_MANAGER']),
  validateMiddleware({ body: runMonthlyInvoicesSchema }),
  runMonthlyInvoices
);

export default router;
