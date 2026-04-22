/**
 * Date utilities for billing cycles, period calculations, and date manipulation.
 * All billing-related date operations go through here.
 */

/**
 * Get the first day of a month for a given date.
 * @param {Date} date
 * @returns {Date}
 */
export function getFirstDayOfMonth(date) {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the last day of a month for a given date.
 * @param {Date} date
 * @returns {Date}
 */
export function getLastDayOfMonth(date) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  result.setDate(0);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get the period month (first day of month) for accounting purposes.
 * @param {Date} date
 * @returns {Date}
 */
export function getPeriodMonth(date) {
  return getFirstDayOfMonth(date);
}

/**
 * Add months to a date safely.
 * @param {Date} date
 * @param {number} months
 * @returns {Date}
 */
export function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Add days to a date.
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculate days between two dates (start inclusive, end exclusive).
 * @param {Date} start
 * @param {Date} end
 * @returns {number}
 */
export function daysBetween(start, end) {
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = endUTC - startUTC;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get the billing anchor day (capped at 28 to avoid February issues).
 * @param {number} dayOfMonth - 1-31
 * @returns {number} 1-28
 */
export function getSafeAnchorDay(dayOfMonth) {
  if (dayOfMonth < 1 || dayOfMonth > 31) {
    throw new RangeError(`Invalid day of month: ${dayOfMonth}`);
  }
  return Math.min(dayOfMonth, 28);
}

/**
 * Calculate the next billing period end date based on anchor day and interval.
 * @param {Date} periodStart
 * @param {number} anchorDay - 1-28
 * @param {string} interval - MONTHLY, QUARTERLY, ANNUAL
 * @returns {Date}
 */
export function getAnchoredEndDate(periodStart, anchorDay, interval) {
  const months = {
    MONTHLY: 1,
    QUARTERLY: 3,
    ANNUAL: 12,
  };
  
  const monthsToAdd = months[interval];
  if (!monthsToAdd) {
    throw new Error(`Invalid interval: ${interval}`);
  }
  
  const endDate = new Date(periodStart);
  endDate.setMonth(endDate.getMonth() + monthsToAdd);
  
  // Set to anchor day, but don't exceed the last day of the month
  const lastDayOfMonth = getLastDayOfMonth(endDate).getDate();
  endDate.setDate(Math.min(anchorDay, lastDayOfMonth));
  endDate.setHours(23, 59, 59, 999);
  
  return endDate;
}

/**
 * Calculate the next billing period start and end dates.
 * @param {Object} params
 * @param {Date} params.currentPeriodEnd
 * @param {number} params.anchorDay
 * @param {string} params.interval
 * @returns {{periodStart: Date, periodEnd: Date}}
 */
export function calculateNextPeriod({ currentPeriodEnd, anchorDay, interval }) {
  const periodStart = addDays(currentPeriodEnd, 1);
  periodStart.setHours(0, 0, 0, 0);
  
  const periodEnd = getAnchoredEndDate(periodStart, anchorDay, interval);
  
  return { periodStart, periodEnd };
}

/**
 * Calculate the initial billing period for a new subscription.
 * @param {Object} params
 * @param {Date} params.startDate
 * @param {number} params.anchorDay
 * @param {string} params.interval
 * @param {number} params.trialDays
 * @returns {{periodStart: Date, periodEnd: Date, trialStart: Date|null, trialEnd: Date|null}}
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
 * Check if a date is today or in the past.
 * @param {Date} date
 * @returns {boolean}
 */
export function isTodayOrPast(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate <= today;
}

/**
 * Check if a date is in the future.
 * @param {Date} date
 * @returns {boolean}
 */
export function isFuture(date) {
  return !isTodayOrPast(date);
}

/**
 * Format date as YYYY-MM-DD for database queries.
 * @param {Date} date
 * @returns {string}
 */
export function toISODate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get the current date in UTC with time set to 00:00:00.
 * @returns {Date}
 */
export function today() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Get the current datetime in UTC.
 * @returns {Date}
 */
export function now() {
  return new Date();
}

/**
 * Parse a date string to Date object.
 * @param {string} dateString - YYYY-MM-DD format
 * @returns {Date}
 */
export function parseDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default {
  getFirstDayOfMonth,
  getLastDayOfMonth,
  getPeriodMonth,
  addMonths,
  addDays,
  daysBetween,
  getSafeAnchorDay,
  getAnchoredEndDate,
  calculateNextPeriod,
  calculateInitialPeriod,
  isTodayOrPast,
  isFuture,
  toISODate,
  today,
  now,
  parseDate,
};