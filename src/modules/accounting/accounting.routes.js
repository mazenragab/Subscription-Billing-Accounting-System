import express from 'express';
import { recognizeRevenue } from './accounting.controller.js';
import { recognizeRevenueSchema } from './accounting.schema.js';
import validateMiddleware from '../../middleware/validate.middleware.js';
import authMiddleware from '../../middleware/auth.middleware.js';
import tenantMiddleware from '../../middleware/tenant.middleware.js';

const router = express.Router();

router.use(authMiddleware, tenantMiddleware);

/**
 * @route POST /api/v1/accounting/recognize-revenue
 * @desc Manual month-end revenue recognition
 * @access Private
 */
router.post(
  '/recognize-revenue',
  validateMiddleware({ body: recognizeRevenueSchema }),
  recognizeRevenue
);

export default router;
