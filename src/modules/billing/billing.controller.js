import { runMonthlyInvoices as runMonthlyInvoicesService } from './billing.service.js';

/**
 * Billing Controller
 */

export async function runMonthlyInvoices(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const userId = req.user.userId;
    const data = req.body;

    const result = await runMonthlyInvoicesService(organizationId, data, userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  runMonthlyInvoices,
};
