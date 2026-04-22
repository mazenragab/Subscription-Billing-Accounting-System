import { runMonthlyInvoicingService } from '../subscriptions/subscriptions.service.js';

/**
 * Billing module service
 */

export async function runMonthlyInvoices(organizationId, data, userId) {
  return await runMonthlyInvoicingService(organizationId, data, userId);
}

export default {
  runMonthlyInvoices,
};
