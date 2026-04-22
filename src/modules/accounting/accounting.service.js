import { processRecognition } from '../../accounting/recognition.service.js';
import { getFirstDayOfMonth } from '../../shared/utils/date.js';

/**
 * Accounting module service
 */

export async function recognizeRevenue(organizationId, data, userId) {
  const periodMonth = getFirstDayOfMonth(new Date(data.period_month));

  const result = await processRecognition({
    organizationId,
    periodMonth,
    createdById: userId,
  });

  return {
    period_month: periodMonth,
    ...result,
  };
}

export default {
  recognizeRevenue,
};
