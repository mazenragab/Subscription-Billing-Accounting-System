import Money from '../shared/utils/money.js';
import { getDaysRemaining, getTotalDaysInPeriod } from './billing-cycle.service.js';
import { ValidationError } from '../shared/errors/index.js';

/**
 * Proration Service
 * Handles proration calculations for subscription upgrades/downgrades
 */

/**
 * Calculate proration credit for old plan
 * @param {Object} params
 * @param {number} params.oldAmountCents - Old plan amount in cents
 * @param {Date} params.currentDate - Current date
 * @param {Date} params.periodEnd - Current period end date
 * @param {Date} params.periodStart - Current period start date
 * @returns {number} Proration credit in cents
 */
export function calculateProrationCredit({ oldAmountCents, currentDate, periodEnd, periodStart }) {
  if (oldAmountCents <= 0) return 0;
  
  const daysRemaining = getDaysRemaining(currentDate, periodEnd);
  const totalDays = getTotalDaysInPeriod(periodStart, periodEnd);
  
  if (totalDays <= 0) return 0;
  if (daysRemaining <= 0) return 0;
  
  // Credit = (remaining_days / total_days) * old_plan_amount
  const factor = daysRemaining / totalDays;
  return Money.multiply(oldAmountCents, factor);
}

/**
 * Calculate proration charge for new plan
 * @param {Object} params
 * @param {number} params.newAmountCents - New plan amount in cents
 * @param {Date} params.currentDate - Current date
 * @param {Date} params.periodEnd - Current period end date
 * @param {Date} params.periodStart - Current period start date
 * @returns {number} Proration charge in cents
 */
export function calculateProrationCharge({ newAmountCents, currentDate, periodEnd, periodStart }) {
  if (newAmountCents <= 0) return 0;
  
  const daysRemaining = getDaysRemaining(currentDate, periodEnd);
  const totalDays = getTotalDaysInPeriod(periodStart, periodEnd);
  
  if (totalDays <= 0) return 0;
  if (daysRemaining <= 0) return 0;
  
  // Charge = (remaining_days / total_days) * new_plan_amount
  const factor = daysRemaining / totalDays;
  return Money.multiply(newAmountCents, factor);
}

/**
 * Calculate net proration amount (charge - credit)
 * @param {Object} params
 * @param {number} params.oldAmountCents - Old plan amount in cents
 * @param {number} params.newAmountCents - New plan amount in cents
 * @param {Date} params.currentDate - Current date
 * @param {Date} params.periodEnd - Current period end date
 * @param {Date} params.periodStart - Current period start date
 * @returns {Object} Proration details
 */
export function calculateNetProration({ oldAmountCents, newAmountCents, currentDate, periodEnd, periodStart }) {
  const credit = calculateProrationCredit({ oldAmountCents, currentDate, periodEnd, periodStart });
  const charge = calculateProrationCharge({ newAmountCents, currentDate, periodEnd, periodStart });
  const netAmount = Money.subtract(charge, credit);
  
  return {
    creditAmountCents: credit,
    chargeAmountCents: charge,
    netAmountCents: netAmount,
    isUpgrade: netAmount > 0,
    isDowngrade: netAmount < 0,
    isNeutral: netAmount === 0,
  };
}

/**
 * Calculate proration for immediate plan change
 * @param {Object} params
 * @param {number} params.oldAmountCents - Old plan amount in cents
 * @param {number} params.newAmountCents - New plan amount in cents
 * @param {Date} params.effectiveDate - Date of plan change
 * @param {Date} params.periodStart - Current period start date
 * @param {Date} params.periodEnd - Current period end date
 * @returns {Object} Proration result with invoice line items
 */
export function calculateImmediateProration({ oldAmountCents, newAmountCents, effectiveDate, periodStart, periodEnd }) {
  // Validate inputs
  if (!Money.isValidOrZero(oldAmountCents)) {
    throw new ValidationError('Invalid old plan amount', [
      { field: 'oldAmountCents', message: 'Must be a valid positive amount in cents' }
    ]);
  }
  
  if (!Money.isValidOrZero(newAmountCents)) {
    throw new ValidationError('Invalid new plan amount', [
      { field: 'newAmountCents', message: 'Must be a valid positive amount in cents' }
    ]);
  }
  
  const proration = calculateNetProration({
    oldAmountCents,
    newAmountCents,
    currentDate: effectiveDate,
    periodEnd,
    periodStart,
  });
  
  const lineItems = [];
  
  // Add credit line for old plan (if any)
  if (proration.creditAmountCents > 0) {
    lineItems.push({
      description: `Credit for unused portion of previous plan`,
      quantity: 1,
      unit_amount_cents: proration.creditAmountCents,
      amount_cents: proration.creditAmountCents,
      type: 'CREDIT',
    });
  }
  
  // Add charge line for new plan (if any)
  if (proration.chargeAmountCents > 0) {
    lineItems.push({
      description: `Charge for new plan (prorated)`,
      quantity: 1,
      unit_amount_cents: proration.chargeAmountCents,
      amount_cents: proration.chargeAmountCents,
      type: 'CHARGE',
    });
  }
  
  return {
    ...proration,
    lineItems,
    shouldCreateInvoice: proration.netAmountCents !== 0,
  };
}

/**
 * Calculate proration for plan change at period end (no immediate charge)
 * @param {Object} params
 * @param {number} params.oldAmountCents - Old plan amount in cents
 * @param {number} params.newAmountCents - New plan amount in cents
 * @returns {Object} Next period adjustment
 */
export function calculatePeriodEndProration({ oldAmountCents, newAmountCents }) {
  const difference = Money.subtract(newAmountCents, oldAmountCents);
  
  return {
    differenceAmountCents: difference,
    isUpgrade: difference > 0,
    isDowngrade: difference < 0,
    isNeutral: difference === 0,
    nextPeriodAmountCents: newAmountCents,
  };
}

export default {
  calculateProrationCredit,
  calculateProrationCharge,
  calculateNetProration,
  calculateImmediateProration,
  calculatePeriodEndProration,
};