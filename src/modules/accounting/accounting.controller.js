import { recognizeRevenue as recognizeRevenueService } from './accounting.service.js';

/**
 * Accounting Controller
 */

export async function recognizeRevenue(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const userId = req.user.userId;
    const data = req.body;

    const result = await recognizeRevenueService(organizationId, data, userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  recognizeRevenue,
};
