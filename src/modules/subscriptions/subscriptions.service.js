import { prisma } from '../../config/database.js';
import logger from '../../shared/utils/logger.js';
import { getSafeAnchorDay, calculateInitialPeriod, calculateNextPeriod } from '../../billing/billing-cycle.service.js';
import { calculateImmediateProration } from '../../billing/proration.service.js';
import { scheduleRenewal, cancelRenewal, processRenewal } from '../../billing/renewal.job.js';
import { generateIssuedInvoiceForPeriod } from '../../billing/invoice-generation.service.js';
import { ValidationError, InvalidTransitionError } from '../../shared/errors/index.js';
import {
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
} from './subscriptions.repository.js';
import { getPlanById } from '../plans/plans.repository.js';
import { getCustomerById } from '../customers/customers.repository.js';
import { getDiscountCodeByCode } from '../discount-codes/discount-codes.repository.js';

// Allowed state transitions
const ALLOWED_TRANSITIONS = {
  TRIALING: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['PAST_DUE', 'PAUSED', 'CANCELLED'],
  PAST_DUE: ['ACTIVE', 'CANCELLED'],
  PAUSED: ['ACTIVE', 'CANCELLED'],
  CANCELLED: [],
  EXPIRED: [],
};

/**
 * Validate subscription state transition
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Desired status
 * @throws {InvalidTransitionError}
 */
export function validateTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  if (!allowed || !allowed.includes(toStatus)) {
    throw new InvalidTransitionError(fromStatus, toStatus);
  }
}

/**
 * Create new subscription
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Subscription data
 * @param {string} userId - User ID creating subscription
 * @returns {Promise<Object>} Created subscription
 */
export async function createSubscriptionService(organizationId, data, userId) {
  // Verify customer exists
  const customer = await getCustomerById(organizationId, data.customer_id);
  
  // Verify plan exists
  const plan = await getPlanById(organizationId, data.plan_id);
  
  // Check for existing active subscription
  const existing = await getActiveSubscriptionForCustomer(organizationId, data.customer_id);
  if (existing) {
    throw new ValidationError('Customer already has an active subscription');
  }
  
  // Calculate billing dates
  const startDate = new Date();
  const anchorDay = data.billing_anchor_day || getSafeAnchorDay(startDate.getDate());
  const trialDays = data.trial_days !== undefined ? data.trial_days : plan.trial_days;
  
  const { periodStart, periodEnd, trialStart, trialEnd } = calculateInitialPeriod({
    startDate,
    anchorDay,
    interval: plan.interval,
    trialDays,
  });
  
  // Determine initial status
  let status = 'ACTIVE';
  if (trialDays > 0) {
    status = 'TRIALING';
  }
  
  // Create subscription
  const subscription = await createSubscription(organizationId, {
    customer_id: data.customer_id,
    plan_id: data.plan_id,
    status,
    billing_anchor_day: anchorDay,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    trial_start: trialStart,
    trial_end: trialEnd,
  });
  
  // Create status history
  await createStatusHistory({
    organization_id: organizationId,
    subscription_id: subscription.id,
    from_status: null,
    to_status: status,
    reason: 'Subscription created',
    changed_by_id: userId,
  });
  
  // Schedule renewal if not cancelled
  if (status !== 'CANCELLED') {
    await scheduleRenewal({
      subscriptionId: subscription.id,
      renewalDate: periodEnd,
    });
  }
  
  logger.info('Subscription created', {
    organizationId,
    subscriptionId: subscription.id,
    customerId: data.customer_id,
    planId: data.plan_id,
    status,
    userId,
  });
  
  return subscription;
}

/**
 * Run monthly invoicing simulation (manual cron trigger).
 * For each due subscription: renew period, create and issue invoice, then seed recognition schedules.
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Execution data
 * @param {string} userId - User ID triggering the run
 * @returns {Promise<Object>} Run summary
 */
export async function runMonthlyInvoicingService(organizationId, data, userId) {
  const asOfDate = data?.as_of_date ? new Date(data.as_of_date) : new Date();
  const limit = data?.limit || 100;

  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      organization_id: organizationId,
      status: { in: ['ACTIVE', 'TRIALING'] },
      cancel_at_period_end: false,
      current_period_end: { lte: asOfDate },
    },
    select: { id: true },
    orderBy: { current_period_end: 'asc' },
    take: limit,
  });

  const summary = {
    as_of_date: asOfDate,
    processed: dueSubscriptions.length,
    renewed: 0,
    invoiced: 0,
    skipped: 0,
    failed: 0,
    invoices: [],
    errors: [],
  };

  for (const dueSubscription of dueSubscriptions) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const renewalResult = await processRenewal(
          dueSubscription.id,
          tx,
          {
            effectiveDate: asOfDate,
            generateInvoice: true,
            invoiceIssuedAt: asOfDate,
            createdById: userId,
          }
        );

        if (!renewalResult.renewed) {
          return {
            renewed: false,
            reason: renewalResult.reason,
            subscriptionId: dueSubscription.id,
          };
        }

        return {
          renewed: true,
          subscriptionId: renewalResult.subscription.id,
          invoiceId: renewalResult.invoice?.id || null,
          invoiceNumber: renewalResult.invoice?.invoice_number || null,
          totalCents: renewalResult.invoice?.total_cents || 0,
        };
      });

      if (!result.renewed) {
        summary.skipped++;
        continue;
      }

      summary.renewed++;
      if (result.invoiceId) {
        summary.invoiced++;
        summary.invoices.push({
          subscription_id: result.subscriptionId,
          invoice_id: result.invoiceId,
          invoice_number: result.invoiceNumber,
          total_cents: result.totalCents,
        });
      } else {
        summary.errors.push({
          subscription_id: result.subscriptionId,
          error: 'Renewed without generated invoice',
        });
      }
    } catch (error) {
      summary.failed++;
      summary.errors.push({
        subscription_id: dueSubscription.id,
        error: error.message,
      });

      logger.error('Monthly invoicing failed for subscription', {
        organizationId,
        subscriptionId: dueSubscription.id,
        error: error.message,
      });
    }
  }

  logger.info('Monthly invoicing run completed', {
    organizationId,
    asOfDate,
    ...summary,
    invoicesCount: summary.invoices.length,
    errorsCount: summary.errors.length,
  });

  return summary;
}

/**
 * Cancel subscription
 * @param {string} organizationId - Organization ID
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} data - Cancel data
 * @param {string} userId - User ID cancelling subscription
 * @returns {Promise<Object>} Updated subscription
 */
export async function cancelSubscription(organizationId, subscriptionId, data, userId) {
  const subscription = await getSubscriptionById(organizationId, subscriptionId);
  
  const { immediate = false, cancellation_reason } = data;
  
  let updatedSubscription;
  let toStatus;
  let reason;
  
  if (immediate) {
    // Immediate cancellation
    toStatus = 'CANCELLED';
    reason = cancellation_reason || 'Cancelled immediately';
    
    validateTransition(subscription.status, toStatus);
    
    updatedSubscription = await updateSubscription(subscriptionId, {
      status: toStatus,
      cancelled_at: new Date(),
      cancellation_reason: reason,
      cancel_at_period_end: false,
    });
    
    // Cancel scheduled renewal
    await cancelRenewal(subscriptionId);
  } else {
    // Cancel at period end
    toStatus = subscription.status;
    reason = cancellation_reason || 'Will cancel at period end';
    
    updatedSubscription = await updateSubscription(subscriptionId, {
      cancel_at_period_end: true,
      cancellation_reason: reason,
    });
  }
  
  // Create status history
  await createStatusHistory({
    organization_id: organizationId,
    subscription_id: subscriptionId,
    from_status: subscription.status,
    to_status: toStatus,
    reason,
    changed_by_id: userId,
  });
  
  logger.info('Subscription cancelled', {
    organizationId,
    subscriptionId,
    immediate,
    reason,
    userId,
  });
  
  return updatedSubscription;
}

/**
 * Pause subscription
 * @param {string} organizationId - Organization ID
 * @param {string} subscriptionId - Subscription ID
 * @param {string} userId - User ID pausing subscription
 * @returns {Promise<Object>} Updated subscription
 */
export async function pauseSubscription(organizationId, subscriptionId, userId) {
  const subscription = await getSubscriptionById(organizationId, subscriptionId);
  
  validateTransition(subscription.status, 'PAUSED');
  
  const updatedSubscription = await updateSubscription(subscriptionId, {
    status: 'PAUSED',
  });
  
  // Cancel scheduled renewal while paused
  await cancelRenewal(subscriptionId);
  
  await createStatusHistory({
    organization_id: organizationId,
    subscription_id: subscriptionId,
    from_status: subscription.status,
    to_status: 'PAUSED',
    reason: 'Subscription paused',
    changed_by_id: userId,
  });
  
  logger.info('Subscription paused', {
    organizationId,
    subscriptionId,
    userId,
  });
  
  return updatedSubscription;
}

/**
 * Resume subscription
 * @param {string} organizationId - Organization ID
 * @param {string} subscriptionId - Subscription ID
 * @param {string} userId - User ID resuming subscription
 * @returns {Promise<Object>} Updated subscription
 */
export async function resumeSubscription(organizationId, subscriptionId, userId) {
  const subscription = await getSubscriptionById(organizationId, subscriptionId);
  
  validateTransition(subscription.status, 'ACTIVE');
  
  // Calculate new period dates based on remaining time
  const now = new Date();
  const periodEnd = subscription.current_period_end;
  
  let updatedSubscription;
  
  if (periodEnd > now) {
    // Still within original period
    updatedSubscription = await updateSubscription(subscriptionId, {
      status: 'ACTIVE',
    });
    
    // Reschedule renewal
    await scheduleRenewal({
      subscriptionId,
      renewalDate: periodEnd,
    });
  } else {
    // Period expired, start new period
    const { periodStart, periodEnd: newPeriodEnd } = calculateNextPeriod({
      currentPeriodEnd: periodEnd,
      anchorDay: subscription.billing_anchor_day,
      interval: subscription.plan.interval,
    });
    
    updatedSubscription = await updateSubscription(subscriptionId, {
      status: 'ACTIVE',
      current_period_start: periodStart,
      current_period_end: newPeriodEnd,
    });
    
    // Schedule new renewal
    await scheduleRenewal({
      subscriptionId,
      renewalDate: newPeriodEnd,
    });
  }
  
  await createStatusHistory({
    organization_id: organizationId,
    subscription_id: subscriptionId,
    from_status: subscription.status,
    to_status: 'ACTIVE',
    reason: 'Subscription resumed',
    changed_by_id: userId,
  });
  
  logger.info('Subscription resumed', {
    organizationId,
    subscriptionId,
    userId,
  });
  
  return updatedSubscription;
}

/**
 * Change plan (upgrade/downgrade)
 * @param {string} organizationId - Organization ID
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} data - Change plan data
 * @param {string} userId - User ID making change
 * @returns {Promise<Object>} Updated subscription
 */
export async function changePlan(organizationId, subscriptionId, data, userId) {
  const subscription = await getSubscriptionById(organizationId, subscriptionId);
  const newPlan = await getPlanById(organizationId, data.new_plan_id);
  
  const { immediate = false, proration_date = new Date() } = data;
  
  let updatedSubscription;
  
  if (immediate) {
    // Calculate proration
    const proration = calculateImmediateProration({
      oldAmountCents: subscription.plan.amount_cents,
      newAmountCents: newPlan.amount_cents,
      effectiveDate: proration_date,
      periodStart: subscription.current_period_start,
      periodEnd: subscription.current_period_end,
    });
    
    // Update subscription immediately
    updatedSubscription = await updateSubscription(subscriptionId, {
      plan_id: newPlan.id,
    });
    
    // Create proration invoice if needed
    if (proration.shouldCreateInvoice) {
      await createProrationInvoice(organizationId, subscription, newPlan, proration, userId);
    }
    
    await createStatusHistory({
      organization_id: organizationId,
      subscription_id: subscriptionId,
      from_status: subscription.status,
      to_status: subscription.status,
      reason: `Plan changed to ${newPlan.name} (immediate)`,
      changed_by_id: userId,
    });
  } else {
    // Schedule change for next period
    updatedSubscription = await updateSubscription(subscriptionId, {
      pending_plan_id: newPlan.id,
    });
    
    await createStatusHistory({
      organization_id: organizationId,
      subscription_id: subscriptionId,
      from_status: subscription.status,
      to_status: subscription.status,
      reason: `Plan change scheduled to ${newPlan.name} at period end`,
      changed_by_id: userId,
    });
  }
  
  logger.info('Plan changed', {
    organizationId,
    subscriptionId,
    oldPlanId: subscription.plan_id,
    newPlanId: newPlan.id,
    immediate,
    userId,
  });
  
  return updatedSubscription;
}

/**
 * Apply discount to subscription
 * @param {string} organizationId - Organization ID
 * @param {string} subscriptionId - Subscription ID
 * @param {string} discountCode - Discount code
 * @param {string} userId - User ID applying discount
 * @returns {Promise<Object>} Applied discount
 */
export async function applyDiscount(organizationId, subscriptionId, discountCode, userId) {
  const subscription = await getSubscriptionById(organizationId, subscriptionId);
  
  // Get discount code
  const discount = await getDiscountCodeByCode(organizationId, discountCode);
  
  if (!discount || !discount.is_active) {
    throw new ValidationError('Invalid or inactive discount code');
  }
  
  // Check validity period
  const now = new Date();
  if (discount.valid_from && discount.valid_from > now) {
    throw new ValidationError('Discount code not yet valid');
  }
  if (discount.valid_until && discount.valid_until < now) {
    throw new ValidationError('Discount code has expired');
  }
  
  // Check max uses
  if (discount.max_uses && discount.uses_count >= discount.max_uses) {
    throw new ValidationError('Discount code has reached maximum uses');
  }
  
  // Apply discount
  const result = await applyDiscountToSubscription(organizationId, subscriptionId, discount.id);
  
  // Increment usage count
  await prisma.discountCode.update({
    where: { id: discount.id },
    data: { uses_count: { increment: 1 } },
  });
  
  logger.info('Discount applied to subscription', {
    organizationId,
    subscriptionId,
    discountCode,
    userId,
  });
  
  return result;
}

/**
 * Get subscription with amounts
 * @param {string} organizationId - Organization ID
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object>} Subscription with calculated amounts
 */
export async function getSubscriptionWithAmountsService(organizationId, subscriptionId) {
  return await getSubscriptionWithAmounts(organizationId, subscriptionId);
}

/**
 * Get subscription history
 * @param {string} organizationId - Organization ID
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Array>} Status history
 */
export async function getSubscriptionHistoryService(organizationId, subscriptionId) {
  return await getSubscriptionHistory(organizationId, subscriptionId);
}

/**
 * List subscriptions
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Subscriptions with pagination
 */
export async function listSubscriptionsService(organizationId, query) {
  const { limit, cursor, status, customer_id, plan_id, search } = query;
  
  const filters = {};
  if (status) filters.status = status;
  if (customer_id) filters.customer_id = customer_id;
  if (plan_id) filters.plan_id = plan_id;
  if (search) filters.search = search;
  
  const pagination = { limit, cursor };
  
  return await listSubscriptions(organizationId, filters, pagination);
}

/**
 * Create proration invoice helper
 */
async function createProrationInvoice(organizationId, subscription, newPlan, proration, userId) {
  if (!proration.shouldCreateInvoice) {
    return null;
  }

  // Credit-note workflow is not implemented yet; only positive proration is invoiced.
  if (proration.netAmountCents <= 0) {
    logger.info('Proration resulted in credit/no-charge; invoice not generated', {
      organizationId,
      subscriptionId: subscription.id,
      netAmount: proration.netAmountCents,
    });
    return null;
  }

  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const prorationPlan = {
      id: newPlan.id,
      name: `${newPlan.name} proration`,
      currency: newPlan.currency || subscription.plan.currency || 'USD',
      amount_cents: proration.netAmountCents,
    };

    const invoice = await generateIssuedInvoiceForPeriod({
      organizationId,
      subscriptionId: subscription.id,
      customerId: subscription.customer_id,
      customerName: subscription.customer.name,
      customerEmail: subscription.customer.email,
      plan: prorationPlan,
      periodStart: now,
      periodEnd: subscription.current_period_end,
      issuedAt: now,
      createdById: userId,
      tx,
      notes: `Proration invoice for immediate change to ${newPlan.name}`,
    });

    logger.info('Proration invoice generated', {
      organizationId,
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      amountCents: invoice.total_cents,
      userId,
    });

    return invoice;
  });
}

export default {
  createSubscriptionService,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  changePlan,
  applyDiscount,
  getSubscriptionWithAmountsService,
  getSubscriptionHistoryService,
  listSubscriptionsService,
  runMonthlyInvoicingService,
  validateTransition,
};
