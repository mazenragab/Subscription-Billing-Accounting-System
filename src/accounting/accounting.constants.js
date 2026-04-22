/**
 * Accounting Constants
 * Chart of accounts codes and accounting rules
 */

// System Account Codes (seeded for every organization)
export const ACCOUNT_CODES = {
  CASH: '1100',
  ACCOUNTS_RECEIVABLE: '1200',
  DEFERRED_REVENUE: '2100',
  SUBSCRIPTION_REVENUE: '4100',
};

// Account Types
export const ACCOUNT_TYPES = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
};

// Normal Balance Types
export const NORMAL_BALANCE = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
};

// Journal Entry Source Types
export const JOURNAL_SOURCE_TYPES = {
  INVOICE: 'INVOICE',
  PAYMENT: 'PAYMENT',
  RECOGNITION: 'RECOGNITION',
  REVERSAL: 'REVERSAL',
  MANUAL: 'MANUAL',
};

// Journal Entry Status
export const JOURNAL_STATUS = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
};

// Line Types
export const LINE_TYPE = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
};

// Recognition Status
export const RECOGNITION_STATUS = {
  PENDING: 'PENDING',
  RECOGNIZED: 'RECOGNIZED',
  SKIPPED: 'SKIPPED',
  VOIDED: 'VOIDED',
};

// System accounts seeded on org creation
export const SYSTEM_ACCOUNTS = [
  {
    code: ACCOUNT_CODES.CASH,
    name: 'Cash',
    type: ACCOUNT_TYPES.ASSET,
    normal_balance: NORMAL_BALANCE.DEBIT,
    is_system: true,
    description: 'Cash and cash equivalents received from customers',
  },
  {
    code: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    name: 'Accounts Receivable',
    type: ACCOUNT_TYPES.ASSET,
    normal_balance: NORMAL_BALANCE.DEBIT,
    is_system: true,
    description: 'Amounts owed by customers for issued invoices',
  },
  {
    code: ACCOUNT_CODES.DEFERRED_REVENUE,
    name: 'Deferred Revenue',
    type: ACCOUNT_TYPES.LIABILITY,
    normal_balance: NORMAL_BALANCE.CREDIT,
    is_system: true,
    description: 'Revenue received or invoiced but not yet earned',
  },
  {
    code: ACCOUNT_CODES.SUBSCRIPTION_REVENUE,
    name: 'Subscription Revenue',
    type: ACCOUNT_TYPES.REVENUE,
    normal_balance: NORMAL_BALANCE.CREDIT,
    is_system: true,
    description: 'Earned subscription revenue recognized after service delivery',
  },
];

// Accounting patterns
export const ACCOUNTING_PATTERNS = {
  INVOICE_ISSUED: {
    description: 'Invoice issued - Debit AR, Credit Deferred Revenue',
    lines: [
      { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, type: LINE_TYPE.DEBIT },
      { accountCode: ACCOUNT_CODES.DEFERRED_REVENUE, type: LINE_TYPE.CREDIT },
    ],
  },
  PAYMENT_RECEIVED: {
    description: 'Payment received - Debit Cash, Credit AR',
    lines: [
      { accountCode: ACCOUNT_CODES.CASH, type: LINE_TYPE.DEBIT },
      { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, type: LINE_TYPE.CREDIT },
    ],
  },
  REVENUE_RECOGNITION: {
    description: 'Revenue recognition - Debit Deferred Revenue, Credit Subscription Revenue',
    lines: [
      { accountCode: ACCOUNT_CODES.DEFERRED_REVENUE, type: LINE_TYPE.DEBIT },
      { accountCode: ACCOUNT_CODES.SUBSCRIPTION_REVENUE, type: LINE_TYPE.CREDIT },
    ],
  },
  REVERSAL: {
    description: 'Reversal - Reverse original journal entry',
    lines: [
      { accountCode: ACCOUNT_CODES.DEFERRED_REVENUE, type: LINE_TYPE.DEBIT },
      { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, type: LINE_TYPE.CREDIT },
    ],
  },
};

export default {
  ACCOUNT_CODES,
  ACCOUNT_TYPES,
  NORMAL_BALANCE,
  JOURNAL_SOURCE_TYPES,
  JOURNAL_STATUS,
  LINE_TYPE,
  RECOGNITION_STATUS,
  SYSTEM_ACCOUNTS,
  ACCOUNTING_PATTERNS,
};