/**
 * System-wide constants — single source of truth for all enums and codes.
 * Never use magic strings in business logic — reference these instead.
 */

// ─── Chart of Accounts — System Account Codes ─────────────────────────────
// These 4 accounts are seeded for every new organization on signup.
// They are protected (is_system=true) and cannot be deleted.
export const ACCOUNT_CODES = Object.freeze({
  CASH: '1100',
  ACCOUNTS_RECEIVABLE: '1200',
  DEFERRED_REVENUE: '2100',
  SUBSCRIPTION_REVENUE: '4100',
});

// ─── Account Types ─────────────────────────────────────────────────────────
export const ACCOUNT_TYPES = Object.freeze({
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
});

// ─── Normal Balance ────────────────────────────────────────────────────────
export const NORMAL_BALANCE = Object.freeze({
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
});

// ─── Journal Entry ─────────────────────────────────────────────────────────
export const JOURNAL_ENTRY_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
});

export const JOURNAL_ENTRY_SOURCE = Object.freeze({
  INVOICE: 'INVOICE',
  PAYMENT: 'PAYMENT',
  RECOGNITION: 'RECOGNITION',
  REVERSAL: 'REVERSAL',
  MANUAL: 'MANUAL',
});

export const LINE_TYPE = Object.freeze({
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
});

// ─── Organization ──────────────────────────────────────────────────────────
export const ORGANIZATION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
});

// ─── User Roles ────────────────────────────────────────────────────────────
export const USER_ROLES = Object.freeze({
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  BILLING_MANAGER: 'BILLING_MANAGER',
  VIEWER: 'VIEWER',
});

// Role hierarchy — higher index = more permissions
export const ROLE_HIERARCHY = ['VIEWER', 'BILLING_MANAGER', 'ADMIN', 'OWNER'];

// ─── Customer ──────────────────────────────────────────────────────────────
export const CUSTOMER_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
});

// ─── Plans ─────────────────────────────────────────────────────────────────
export const PLAN_INTERVAL = Object.freeze({
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  ANNUAL: 'ANNUAL',
});

// Number of months per interval — used in proration & MRR calculations
export const INTERVAL_MONTHS = Object.freeze({
  MONTHLY: 1,
  QUARTERLY: 3,
  ANNUAL: 12,
});

// ─── Subscriptions ─────────────────────────────────────────────────────────
export const SUBSCRIPTION_STATUS = Object.freeze({
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
});

/**
 * State machine — defines which transitions are allowed.
 * Key = current status, Value = array of allowed next statuses.
 */
export const SUBSCRIPTION_TRANSITIONS = Object.freeze({
  TRIALING: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['PAST_DUE', 'PAUSED', 'CANCELLED'],
  PAST_DUE: ['ACTIVE', 'CANCELLED'],
  PAUSED: ['ACTIVE', 'CANCELLED'],
  CANCELLED: [],   // terminal state
  EXPIRED: [],     // terminal state
});

// Maximum safe anchor day (avoids Feb 29/30/31 issues)
export const MAX_BILLING_ANCHOR_DAY = 28;

// ─── Invoices ──────────────────────────────────────────────────────────────
export const INVOICE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  PAID: 'PAID',
  VOID: 'VOID',
  UNCOLLECTIBLE: 'UNCOLLECTIBLE',
});

// ─── Payments ──────────────────────────────────────────────────────────────
export const PAYMENT_METHOD = Object.freeze({
  BANK_TRANSFER: 'BANK_TRANSFER',
  CREDIT_CARD: 'CREDIT_CARD',
  CASH: 'CASH',
  CHECK: 'CHECK',
  OTHER: 'OTHER',
});

export const PAYMENT_ATTEMPT_STATUS = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PENDING: 'PENDING',
});

// ─── Revenue Recognition ───────────────────────────────────────────────────
export const RECOGNITION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  RECOGNIZED: 'RECOGNIZED',
  SKIPPED: 'SKIPPED',
  VOIDED: 'VOIDED',
});

// ─── Discounts ─────────────────────────────────────────────────────────────
export const DISCOUNT_TYPE = Object.freeze({
  PERCENTAGE: 'PERCENTAGE',   // value = basis points (5000 = 50%)
  FIXED_AMOUNT: 'FIXED_AMOUNT', // value = cents
});

// ─── Webhooks ──────────────────────────────────────────────────────────────
export const WEBHOOK_STATUS = Object.freeze({
  PENDING: 'PENDING',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
});

/**
 * All webhook event types fired by the system.
 * Subscribe to these when registering a webhook endpoint.
 */
export const WEBHOOK_EVENTS = Object.freeze({
  TENANT_CREATED: 'tenant.created',

  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_DELETED: 'customer.deleted',

  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_ACTIVATED: 'subscription.activated',
  SUBSCRIPTION_TRIAL_STARTED: 'subscription.trial_started',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_UPGRADED: 'subscription.upgraded',
  SUBSCRIPTION_DOWNGRADED: 'subscription.downgraded',
  SUBSCRIPTION_PAUSED: 'subscription.paused',
  SUBSCRIPTION_RESUMED: 'subscription.resumed',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  SUBSCRIPTION_EXPIRED: 'subscription.expired',

  INVOICE_CREATED: 'invoice.created',
  INVOICE_ISSUED: 'invoice.issued',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_VOIDED: 'invoice.voided',
  INVOICE_UNCOLLECTIBLE: 'invoice.uncollectible',
  INVOICE_PAYMENT_DUE: 'invoice.payment_due',

  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',

  RECOGNITION_COMPLETED: 'recognition.completed',
});

// ─── System Account Seeds ──────────────────────────────────────────────────
/**
 * The 4 system accounts seeded for every new organization.
 * Matches the accounting patterns defined in the architecture spec.
 */
export const SYSTEM_ACCOUNTS = [
  {
    code: ACCOUNT_CODES.CASH,
    name: 'Cash',
    type: ACCOUNT_TYPES.ASSET,
    normalBalance: NORMAL_BALANCE.DEBIT,
    description: 'Cash and cash equivalents received from customers',
  },
  {
    code: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    name: 'Accounts Receivable',
    type: ACCOUNT_TYPES.ASSET,
    normalBalance: NORMAL_BALANCE.DEBIT,
    description: 'Amounts owed by customers for issued invoices',
  },
  {
    code: ACCOUNT_CODES.DEFERRED_REVENUE,
    name: 'Deferred Revenue',
    type: ACCOUNT_TYPES.LIABILITY,
    normalBalance: NORMAL_BALANCE.CREDIT,
    description: 'Revenue received or invoiced but not yet earned (service not yet delivered)',
  },
  {
    code: ACCOUNT_CODES.SUBSCRIPTION_REVENUE,
    name: 'Subscription Revenue',
    type: ACCOUNT_TYPES.REVENUE,
    normalBalance: NORMAL_BALANCE.CREDIT,
    description: 'Earned subscription revenue recognized after service delivery',
  },
];

// For default export (if you prefer)
export default {
  ACCOUNT_CODES,
  ACCOUNT_TYPES,
  NORMAL_BALANCE,
  JOURNAL_ENTRY_STATUS,
  JOURNAL_ENTRY_SOURCE,
  LINE_TYPE,
  ORGANIZATION_STATUS,
  USER_ROLES,
  ROLE_HIERARCHY,
  CUSTOMER_STATUS,
  PLAN_INTERVAL,
  INTERVAL_MONTHS,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TRANSITIONS,
  MAX_BILLING_ANCHOR_DAY,
  INVOICE_STATUS,
  PAYMENT_METHOD,
  PAYMENT_ATTEMPT_STATUS,
  RECOGNITION_STATUS,
  DISCOUNT_TYPE,
  WEBHOOK_STATUS,
  WEBHOOK_EVENTS,
  SYSTEM_ACCOUNTS,
};