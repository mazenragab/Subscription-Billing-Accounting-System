import {
  createSubscriptionService,
  cancelSubscription as cancelSubscriptionService,
  pauseSubscription as pauseSubscriptionService,
  resumeSubscription as resumeSubscriptionService,
  changePlan,
  applyDiscount,
  getSubscriptionWithAmountsService,
  getSubscriptionHistoryService,
  listSubscriptionsService,
} from './subscriptions.service.js';

/**
 * Subscriptions Controller
 * Handles HTTP request/response for subscription management
 */

/**
 * List subscriptions
 */
export async function listSubscriptions(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await listSubscriptionsService(organizationId, query);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get subscription by ID
 */
export async function getSubscription(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    
    const result = await getSubscriptionWithAmountsService(organizationId, id);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create subscription
 */
export async function createSubscription(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await createSubscriptionService(organizationId, data, userId);
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await cancelSubscriptionService(organizationId, id, data, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Pause subscription
 */
export async function pauseSubscription(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    
    const result = await pauseSubscriptionService(organizationId, id, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Resume subscription
 */
export async function resumeSubscription(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    
    const result = await resumeSubscriptionService(organizationId, id, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Upgrade subscription (immediate plan change with proration)
 */
export async function upgradeSubscription(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    const data = { ...req.body, immediate: true };
    
    const result = await changePlan(organizationId, id, data, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Downgrade subscription (plan change at period end)
 */
export async function downgradeSubscription(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    const data = { ...req.body, immediate: false };
    
    const result = await changePlan(organizationId, id, data, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Apply discount to subscription
 */
export async function applyDiscountToSubscription(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    const { discount_code } = req.body;
    
    const result = await applyDiscount(organizationId, id, discount_code, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get subscription history
 */
export async function getSubscriptionHistory(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    
    const result = await getSubscriptionHistoryService(organizationId, id);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export default {
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
};