/**
 * Money utility — ALL monetary operations go through here.
 *
 * RULE: Money is ALWAYS stored and processed as cents (integer).
 * NEVER use floating-point arithmetic on monetary values.
 * 0.1 + 0.2 !== 0.3 in JavaScript — use these helpers instead.
 *
 * @example
 *   // Input from API (dollars) → store as cents
 *   const cents = Money.toCents(99.99);  // 9999
 *
 *   // Output to API (cents → dollars)
 *   const dollars = Money.toDollars(9999);  // 99.99
 *
 *   // Safe addition
 *   const total = Money.add(100, 200, 300);  // 600
 */

const Money = {
  /**
   * Convert dollars (from API input) to cents for storage.
   * @param {number} dollars
   * @returns {number} integer cents
   */
  toCents(dollars) {
    if (typeof dollars !== 'number' || isNaN(dollars)) {
      throw new TypeError(`Money.toCents: expected number, got ${typeof dollars}`);
    }
    return Math.round(dollars * 100);
  },

  /**
   * Convert cents (from DB) to dollars for API responses.
   * @param {number} cents
   * @returns {number}
   */
  toDollars(cents) {
    if (!Number.isInteger(cents)) {
      throw new TypeError(`Money.toDollars: expected integer cents, got ${cents}`);
    }
    return cents / 100;
  },

  /**
   * Format cents as a human-readable currency string.
   * @param {number} cents
   * @param {string} [currency='USD']
   * @param {string} [locale='en-US']
   * @returns {string} e.g. "$99.99"
   */
  format(cents, currency = 'USD', locale = 'en-US') {
    if (!Number.isInteger(cents)) {
      throw new TypeError(`Money.format: expected integer cents, got ${cents}`);
    }
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
      cents / 100
    );
  },

  /**
   * Safe addition of multiple cent amounts.
   * Ensures no floating-point drift.
   * @param {...number} amounts - cent values (integers)
   * @returns {number} sum in cents
   */
  add(...amounts) {
    return amounts.reduce((sum, amount) => {
      if (!Number.isInteger(amount)) {
        throw new TypeError(`Money.add: all amounts must be integers, got ${amount}`);
      }
      return sum + amount;
    }, 0);
  },

  /**
   * Subtract cents safely.
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  subtract(a, b) {
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new TypeError('Money.subtract: both arguments must be integers');
    }
    return a - b;
  },

  /**
   * Multiply cents by a factor (e.g., for proration).
   * Always rounds to nearest integer cent.
   * @param {number} cents
   * @param {number} factor
   * @returns {number}
   */
  multiply(cents, factor) {
    if (!Number.isInteger(cents)) {
      throw new TypeError(`Money.multiply: cents must be integer, got ${cents}`);
    }
    return Math.round(cents * factor);
  },

  /**
   * Calculate proration: how much of an amount corresponds to a fraction of a period.
   * @param {number} amountCents - full period amount
   * @param {number} daysUsed
   * @param {number} totalDays
   * @returns {number} prorated amount in cents
   */
  prorate(amountCents, daysUsed, totalDays) {
    if (!Number.isInteger(amountCents) || !Number.isInteger(daysUsed) || !Number.isInteger(totalDays)) {
      throw new TypeError('Money.prorate: all arguments must be integers');
    }
    if (totalDays <= 0) throw new RangeError('Money.prorate: totalDays must be > 0');
    if (daysUsed < 0) throw new RangeError('Money.prorate: daysUsed must be >= 0');
    return Math.round((amountCents * daysUsed) / totalDays);
  },

  /**
   * Apply a percentage discount expressed in basis points.
   * @param {number} amountCents
   * @param {number} basisPoints - e.g. 5000 = 50%, 1000 = 10%
   * @returns {number} discount amount in cents
   */
  applyBasisPoints(amountCents, basisPoints) {
    if (!Number.isInteger(amountCents) || !Number.isInteger(basisPoints)) {
      throw new TypeError('Money.applyBasisPoints: arguments must be integers');
    }
    return Math.round((amountCents * basisPoints) / 10000);
  },

  /**
   * Validate that a value is a valid positive cent amount.
   * @param {number} cents
   * @returns {boolean}
   */
  isValid(cents) {
    return Number.isInteger(cents) && cents > 0;
  },

  /**
   * Validate that a value is a valid non-negative cent amount.
   * @param {number} cents
   * @returns {boolean}
   */
  isValidOrZero(cents) {
    return Number.isInteger(cents) && cents >= 0;
  },
};

export default Money;