import { addDays, addMonths, getLastDayOfMonth, daysBetween } from '../shared/utils/date.js';
import { ValidationError } from '../shared/errors/index.js';
export { getSafeAnchorDay } from '../shared/utils/date.js';

/**
 * Billing Cycle Engine
 * Handles period calculations, anchor day logic, and billing cycle management
 */

/**
 * Calculate the initial billing period for a new subscription
 * @param {Object} params
 * @param {Date} params.startDate - Subscription start date
 * @param {number} params.anchorDay - Billing anchor day (1-28)
 * @param {string} params.interval - MONTHLY, QUARTERLY, ANNUAL
 * @param {number} params.trialDays - Trial period in days
 * @returns {Object} Period dates
 */
export function calculateInitialPeriod({ startDate, anchorDay, interval, trialDays = 0 }) {
  const periodStart = new Date(startDate);
  periodStart.setHours(0, 0, 0, 0);
  
  let trialStart = null;
  let trialEnd = null;
  let effectiveStart = periodStart;
  
  if (trialDays > 0) {
    trialStart = periodStart;
    trialEnd = addDays(periodStart, trialDays);
    effectiveStart = trialEnd;
  }
  
  const periodEnd = getAnchoredEndDate(effectiveStart, anchorDay, interval);
  
  return {
    periodStart,
    periodEnd,
    trialStart,
    trialEnd,
  };
}

/**
 * Calculate the next billing period after current period ends
 * @param {Object} params
 * @param {Date} params.currentPeriodEnd - End date of current period
 * @param {number} params.anchorDay - Billing anchor day
 * @param {string} params.interval - MONTHLY, QUARTERLY, ANNUAL
 * @returns {Object} Next period dates
 */
export function calculateNextPeriod({ currentPeriodEnd, anchorDay, interval }) {
  const periodStart = addDays(currentPeriodEnd, 1);
  periodStart.setHours(0, 0, 0, 0);
  
  const periodEnd = getAnchoredEndDate(periodStart, anchorDay, interval);
  
  return { periodStart, periodEnd };
}

/**
 * Get anchored end date based on anchor day and interval
 * @param {Date} startDate - Period start date
 * @param {number} anchorDay - Billing anchor day (1-28)
 * @param {string} interval - MONTHLY, QUARTERLY, ANNUAL
 * @returns {Date} End date
 */
export function getAnchoredEndDate(startDate, anchorDay, interval) {
  const monthsMap = {
    MONTHLY: 1,
    QUARTERLY: 3,
    ANNUAL: 12,
  };
  
  const monthsToAdd = monthsMap[interval];
  if (!monthsToAdd) {
    throw new ValidationError(`Invalid interval: ${interval}`, [
      { field: 'interval', message: 'Must be MONTHLY, QUARTERLY, or ANNUAL' }
    ]);
  }
  
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + monthsToAdd);
  
  // Set to anchor day, but don't exceed the last day of the month
  const lastDayOfMonth = getLastDayOfMonth(endDate).getDate();
  endDate.setDate(Math.min(anchorDay, lastDayOfMonth));
  endDate.setHours(23, 59, 59, 999);
  
  return endDate;
}

/**
 * Calculate days remaining in current period
 * @param {Date} currentDate - Current date
 * @param {Date} periodEnd - Period end date
 * @returns {number} Days remaining
 */
export function getDaysRemaining(currentDate, periodEnd) {
  const days = daysBetween(currentDate, periodEnd);
  return Math.max(0, days);
}

/**
 * Get total days in current period
 * @param {Date} periodStart - Period start date
 * @param {Date} periodEnd - Period end date
 * @returns {number} Total days in period
 */
export function getTotalDaysInPeriod(periodStart, periodEnd) {
  return daysBetween(periodStart, periodEnd);
}

/**
 * Validate that a subscription can be renewed
 * @param {Object} subscription - Subscription object
 * @returns {boolean} Whether renewal is valid
 */
export function canRenewSubscription(subscription) {
  const validStatuses = ['ACTIVE', 'TRIALING'];
  return validStatuses.includes(subscription.status) && !subscription.cancel_at_period_end;
}

/**
 * Calculate the proration factor for a partial period
 * @param {Date} startDate - Start of proration period
 * @param {Date} endDate - End of proration period
 * @param {Date} periodStart - Full period start
 * @param {Date} periodEnd - Full period end
 * @returns {number} Proration factor (0-1)
 */
export function calculateProrationFactor(startDate, endDate, periodStart, periodEnd) {
  const totalDays = getTotalDaysInPeriod(periodStart, periodEnd);
  const daysUsed = daysBetween(startDate, endDate);
  
  if (totalDays <= 0) return 0;
  return daysUsed / totalDays;
}

/**
 * Validate billing anchor day (must be between 1 and 28)
 * @param {number} anchorDay - Anchor day to validate
 * @returns {number} Safe anchor day
 */
export function validateAnchorDay(anchorDay) {
  return getSafeAnchorDay(anchorDay);
}

export default {
  calculateInitialPeriod,
  calculateNextPeriod,
  getAnchoredEndDate,
  getDaysRemaining,
  getTotalDaysInPeriod,
  canRenewSubscription,
  calculateProrationFactor,
  validateAnchorDay,
};