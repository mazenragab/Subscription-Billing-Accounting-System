import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../shared/errors/index.js';

/**
 * Subscriptions Repository
 * Handles database operations for subscriptions
 */

/**
 * Get subscription by ID with tenant isolation
 * @param {string} organizationId - Organization ID
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object>} Subscription with relations
 */
export async function getSubscriptionById(organizationId, subscriptionId) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      organization_id: organizationId,
    },
    include: {
      plan: true,
      customer: true,
      pending_plan: true,
      discounts: {
        include: {
          discount_code: true,
        },
      },
      status_history: {
        orderBy: { created_at: 'desc' },
        take: 10,
      },
    },
  });
  
  if (!subscription) {
    throw new NotFoundError('Subscription');
  }
  
  return subscription;
}

/**
 * Get active subscription for customer
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object|null>} Active subscription or null
 */
export async function getActiveSubscriptionForCustomer(organizationId, customerId) {
  return await prisma.subscription.findFirst({
    where: {
      organization_id: organizationId,
      customer_id: customerId,
      status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
    },
    include: {
      plan: true,
    },
  });
}

/**
 * List subscriptions with pagination and filters
 * @param {string} organizationId - Organization ID
 * @param {Object} filters - Filters (status, customer_id, plan_id, search)
 * @param {Object} pagination - Pagination params
 * @returns {Promise<Object>} Subscriptions with pagination
 */
export async function listSubscriptions(organizationId, filters = {}, pagination = {}) {
  const { status, customer_id, plan_id, search } = filters;
  const { limit = 20, cursor = null } = pagination;
  
  const where = {
    organization_id: organizationId,
  };
  
  if (status) {
    where.status = status;
  }
  
  if (customer_id) {
    where.customer_id = customer_id;
  }
  
  if (plan_id) {
    where.plan_id = plan_id;
  }
  
  if (search) {
    where.OR = [
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { email: { contains: search, mode: 'insensitive' } } },
      { plan: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }
  
  if (cursor) {
    where.id = { gt: cursor };
  }
  
  const subscriptions = await prisma.subscription.findMany({
    where,
    include: {
      plan: true,
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      pending_plan: true,
      _count: {
        select: {
          invoices: {
            where: {
              status: { in: ['ISSUED', 'PAID'] },
            },
          },
        },
      },
    },
    orderBy: { created_at: 'desc' },
    take: limit + 1,
  });
  
  const hasNextPage = subscriptions.length > limit;
  const data = hasNextPage ? subscriptions.slice(0, limit) : subscriptions;
  const nextCursor = hasNextPage && data.length > 0 ? data[data.length - 1].id : null;
  
  return {
    data,
    pagination: {
      limit,
      hasNextPage,
      nextCursor,
      count: data.length,
    },
  };
}

/**
 * Create subscription
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Subscription data
 * @returns {Promise<Object>} Created subscription
 */
export async function createSubscription(organizationId, data) {
  // Check for existing active subscription
  const existing = await getActiveSubscriptionForCustomer(organizationId, data.customer_id);
  if (existing) {
    throw new ConflictError('Customer already has an active subscription');
  }
  
  return await prisma.subscription.create({
    data: {
      organization_id: organizationId,
      customer_id: data.customer_id,
      plan_id: data.plan_id,
      status: data.status,
      billing_anchor_day: data.billing_anchor_day,
      current_period_start: data.current_period_start,
      current_period_end: data.current_period_end,
      trial_start: data.trial_start,
      trial_end: data.trial_end,
      cancel_at_period_end: data.cancel_at_period_end || false,
    },
    include: {
      plan: true,
      customer: true,
    },
  });
}

/**
 * Update subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated subscription
 */
export async function updateSubscription(subscriptionId, data) {
  return await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      ...data,
      updated_at: new Date(),
    },
    include: {
      plan: true,
      customer: true,
      pending_plan: true,
    },
  });
}

/**
 * Create subscription status history entry
 * @param {Object} data - History data
 * @returns {Promise<Object>} Created history entry
 */
export async function createStatusHistory(data) {
  return await prisma.subscriptionStatusHistory.create({
    data: {
      organization_id: data.organization_id,
      subscription_id: data.subscription_id,
      from_status: data.from_status,
      to_status: data.to_status,
      reason: data.reason,
      changed_by_id: data.changed_by_id,
    },
  });
}

/**
 * Get subscription status history
 * @param {string} organizationId - Organization ID
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Array>} Status history
 */
export async function getSubscriptionHistory(organizationId, subscriptionId) {
  await getSubscriptionById(organizationId, subscriptionId);
  
  return await prisma.subscriptionStatusHistory.findMany({
    where: {
      subscription_id: subscriptionId,
    },
    include: {
      changed_by: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });
}

/**
 * Apply discount to subscription
 * @param {string} organizationId - Organization ID
 * @param {string} subscriptionId - Subscription ID
 * @param {string} discountCodeId - Discount code ID
 * @returns {Promise<Object>} Created subscription discount
 */
export async function applyDiscountToSubscription(organizationId, subscriptionId, discountCodeId) {
  // Check if discount already applied
  const existing = await prisma.subscriptionDiscount.findFirst({
    where: {
      subscription_id: subscriptionId,
      discount_code_id: discountCodeId,
      is_active: true,
    },
  });
  
  if (existing) {
    throw new ConflictError('Discount already applied to this subscription');
  }
  
  return await prisma.subscriptionDiscount.create({
    data: {
      organization_id: organizationId,
      subscription_id: subscriptionId,
      discount_code_id: discountCodeId,
      applied_at: new Date(),
      is_active: true,
    },
    include: {
      discount_code: true,
    },
  });
}

/**
 * Remove discount from subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {string} discountCodeId - Discount code ID
 * @returns {Promise<boolean>} Success status
 */
export async function removeDiscountFromSubscription(subscriptionId, discountCodeId) {
  await prisma.subscriptionDiscount.updateMany({
    where: {
      subscription_id: subscriptionId,
      discount_code_id: discountCodeId,
      is_active: true,
    },
    data: {
      is_active: false,
      expires_at: new Date(),
    },
  });
  
  return true;
}

/**
 * Get subscription with discount calculation
 * @param {string} organizationId - Organization ID
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object>} Subscription with calculated amounts
 */
export async function getSubscriptionWithAmounts(organizationId, subscriptionId) {
  const subscription = await getSubscriptionById(organizationId, subscriptionId);
  
  // Calculate discounted amount
  let discountAmountCents = 0;
  let finalAmountCents = subscription.plan.amount_cents;
  
  for (const discount of subscription.discounts) {
    if (discount.is_active && (!discount.expires_at || discount.expires_at > new Date())) {
      if (discount.discount_code.type === 'PERCENTAGE') {
        // Percentage discount (basis points)
        const discountValue = Math.floor((subscription.plan.amount_cents * discount.discount_code.value) / 10000);
        discountAmountCents += discountValue;
      } else {
        // Fixed amount discount
        discountAmountCents += discount.discount_code.value;
      }
    }
  }
  
  finalAmountCents = Math.max(0, subscription.plan.amount_cents - discountAmountCents);
  
  return {
    ...subscription,
    original_amount_cents: subscription.plan.amount_cents,
    discount_amount_cents: discountAmountCents,
    final_amount_cents: finalAmountCents,
  };
}

export default {
  getSubscriptionById,
  getActiveSubscriptionForCustomer,
  listSubscriptions,
  createSubscription,
  updateSubscription,
  createStatusHistory,
  getSubscriptionHistory,
  applyDiscountToSubscription,
  removeDiscountFromSubscription,
  getSubscriptionWithAmounts,
};