import { prisma } from '../config/database.js';
import logger from '../shared/utils/logger.js';
import Money from '../shared/utils/money.js';
import { getPeriodMonth } from '../shared/utils/date.js';
import { AccountingError, NotFoundError } from '../shared/errors/index.js';
import { verifyAccounts } from './accounts.service.js';
import { 
  JOURNAL_SOURCE_TYPES, 
  JOURNAL_STATUS, 
  LINE_TYPE,
  ACCOUNTING_PATTERNS 
} from './accounting.constants.js';

/**
 * Journal Entry Service
 * THE ONLY writer to journal_entries and journal_entry_lines tables
 * All accounting entries MUST go through this service
 */

/**
 * Create a balanced journal entry atomically
 * MUST be called inside a Prisma $transaction
 * 
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.description - Entry description
 * @param {string} params.sourceType - Source type (INVOICE, PAYMENT, RECOGNITION, REVERSAL, MANUAL)
 * @param {string} params.sourceId - ID of the source record
 * @param {Date} params.periodMonth - First day of accounting month
 * @param {Array<Object>} params.lines - Journal entry lines
 * @param {string} params.lines[].accountCode - Account code
 * @param {string} params.lines[].type - DEBIT or CREDIT
 * @param {number} params.lines[].amountCents - Amount in cents
 * @param {string} [params.lines[].description] - Line description
 * @param {string|null} params.createdById - User ID who created the entry
 * @param {Object} params.tx - Prisma transaction client
 * @returns {Promise<Object>} Created journal entry with lines
 */
export async function createJournalEntry({
  organizationId,
  description,
  sourceType,
  sourceId,
  periodMonth,
  lines,
  createdById = null,
  tx,
}) {
  // Validate input
  validateJournalEntryInput({ organizationId, description, sourceType, sourceId, periodMonth, lines });
  
  // Verify all accounts exist and are active
  const accountMap = await verifyAccounts(organizationId, lines);
  
  // Calculate totals and validate balance
  const { totalDebits, totalCredits, validatedLines } = calculateAndValidateLines(lines, accountMap);
  
  // Get next entry number (atomic operation)
  const entryNumber = await getNextEntryNumber(organizationId, tx);
  
  // Create journal entry
  const journalEntry = await tx.journalEntry.create({
    data: {
      organization_id: organizationId,
      entry_number: entryNumber,
      description,
      status: JOURNAL_STATUS.POSTED,
      source_type: sourceType,
      source_id: sourceId,
      total_debit_cents: totalDebits,
      period_month: periodMonth,
      posted_at: new Date(),
      created_by_id: createdById,
      lines: {
        create: validatedLines.map(line => ({
          organization_id: organizationId,
          account_id: line.accountId,
          type: line.type,
          amount_cents: line.amountCents,
          currency: 'USD',
          description: line.description || null,
        })),
      },
    },
    include: {
      lines: true,
    },
  });
  
  logger.info('Journal entry created', {
    organizationId,
    entryId: journalEntry.id,
    entryNumber: entryNumber.toString(),
    sourceType,
    sourceId,
    totalDebits,
    totalCredits,
  });
  
  return journalEntry;
}

/**
 * Validate journal entry input
 */
function validateJournalEntryInput({ organizationId, description, sourceType, sourceId, periodMonth, lines }) {
  if (!organizationId) {
    throw new AccountingError('Organization ID is required');
  }
  
  if (!description || description.trim().length === 0) {
    throw new AccountingError('Description is required', [
      { field: 'description', message: 'Journal entry must have a description' }
    ]);
  }
  
  const validSourceTypes = Object.values(JOURNAL_SOURCE_TYPES);
  if (!validSourceTypes.includes(sourceType)) {
    throw new AccountingError(`Invalid source type: ${sourceType}`, [
      { field: 'sourceType', message: `Must be one of: ${validSourceTypes.join(', ')}` }
    ]);
  }
  
  if (!sourceId) {
    throw new AccountingError('Source ID is required');
  }
  
  if (!periodMonth || !(periodMonth instanceof Date)) {
    throw new AccountingError('Valid period month is required');
  }
  
  if (!lines || lines.length < 2) {
    throw new AccountingError('Journal entry must have at least 2 lines', [
      { field: 'lines', message: 'Minimum 2 lines required' }
    ]);
  }
}

/**
 * Calculate totals and validate lines balance
 */
function calculateAndValidateLines(lines, accountMap) {
  let totalDebits = 0;
  let totalCredits = 0;
  const validatedLines = [];
  
  for (const line of lines) {
    // Validate amount
    if (!Money.isValid(line.amountCents)) {
      throw new AccountingError(`Invalid amount: ${line.amountCents}`, [
        { field: 'amountCents', message: 'Amount must be a positive integer in cents' }
      ]);
    }
    
    // Validate type
    if (line.type !== LINE_TYPE.DEBIT && line.type !== LINE_TYPE.CREDIT) {
      throw new AccountingError(`Invalid line type: ${line.type}`, [
        { field: 'type', message: 'Must be DEBIT or CREDIT' }
      ]);
    }
    
    // Get account
    const account = accountMap.get(line.accountCode);
    if (!account) {
      throw new AccountingError(`Account not found: ${line.accountCode}`, [
        { field: 'accountCode', message: `Account ${line.accountCode} does not exist` }
      ]);
    }
    
    // Add to totals
    if (line.type === LINE_TYPE.DEBIT) {
      totalDebits = Money.add(totalDebits, line.amountCents);
    } else {
      totalCredits = Money.add(totalCredits, line.amountCents);
    }
    
    validatedLines.push({
      accountId: account.id,
      type: line.type,
      amountCents: line.amountCents,
      description: line.description,
    });
  }
  
  // Validate balance
  if (totalDebits !== totalCredits) {
    throw new AccountingError(
      `Journal entry does not balance: Debits (${totalDebits}) vs Credits (${totalCredits})`,
      [
        { field: 'lines', message: `Debits must equal credits. Difference: ${Math.abs(totalDebits - totalCredits)} cents` }
      ]
    );
  }
  
  return { totalDebits, totalCredits, validatedLines };
}

/**
 * Get next sequential entry number for organization
 * Uses SELECT FOR UPDATE to prevent race conditions
 */
async function getNextEntryNumber(organizationId, tx) {
  const result = await tx.$queryRaw`
    UPDATE billing_settings
    SET journal_sequence = journal_sequence + 1
    WHERE organization_id = ${organizationId}
    RETURNING journal_sequence
  `;

  if (!result || result.length === 0) {
    throw new AccountingError('Billing settings not found for organization');
  }

  return BigInt(result[0].journal_sequence);
}

/**
 * Create invoice journal entry (Pattern 1)
 * DR Accounts Receivable | CR Deferred Revenue
 */
export async function createInvoiceJournalEntry({
  organizationId,
  invoiceId,
  totalCents,
  createdById = null,
  tx,
}) {
  const periodMonth = getPeriodMonth(new Date());
  
  return await createJournalEntry({
    organizationId,
    description: `Invoice ${invoiceId} issued`,
    sourceType: JOURNAL_SOURCE_TYPES.INVOICE,
    sourceId: invoiceId,
    periodMonth,
    lines: [
      {
        accountCode: ACCOUNTING_PATTERNS.INVOICE_ISSUED.lines[0].accountCode,
        type: LINE_TYPE.DEBIT,
        amountCents: totalCents,
        description: 'Accounts Receivable from invoice',
      },
      {
        accountCode: ACCOUNTING_PATTERNS.INVOICE_ISSUED.lines[1].accountCode,
        type: LINE_TYPE.CREDIT,
        amountCents: totalCents,
        description: 'Deferred revenue from invoice',
      },
    ],
    createdById,
    tx,
  });
}

/**
 * Create payment journal entry (Pattern 2)
 * DR Cash | CR Accounts Receivable
 */
export async function createPaymentJournalEntry({
  organizationId,
  paymentId,
  amountCents,
  createdById = null,
  tx,
}) {
  const periodMonth = getPeriodMonth(new Date());
  
  return await createJournalEntry({
    organizationId,
    description: `Payment ${paymentId} received`,
    sourceType: JOURNAL_SOURCE_TYPES.PAYMENT,
    sourceId: paymentId,
    periodMonth,
    lines: [
      {
        accountCode: ACCOUNTING_PATTERNS.PAYMENT_RECEIVED.lines[0].accountCode,
        type: LINE_TYPE.DEBIT,
        amountCents,
        description: 'Cash received from customer',
      },
      {
        accountCode: ACCOUNTING_PATTERNS.PAYMENT_RECEIVED.lines[1].accountCode,
        type: LINE_TYPE.CREDIT,
        amountCents,
        description: 'Apply payment to accounts receivable',
      },
    ],
    createdById,
    tx,
  });
}

/**
 * Create revenue recognition journal entry (Pattern 3)
 * DR Deferred Revenue | CR Subscription Revenue
 */
export async function createRecognitionJournalEntry({
  organizationId,
  recognitionId,
  amountCents,
  periodMonth,
  createdById = null,
  tx,
}) {
  return await createJournalEntry({
    organizationId,
    description: `Revenue recognition for period ${periodMonth.toISOString().slice(0, 7)}`,
    sourceType: JOURNAL_SOURCE_TYPES.RECOGNITION,
    sourceId: recognitionId,
    periodMonth,
    lines: [
      {
        accountCode: ACCOUNTING_PATTERNS.REVENUE_RECOGNITION.lines[0].accountCode,
        type: LINE_TYPE.DEBIT,
        amountCents,
        description: 'Release deferred revenue',
      },
      {
        accountCode: ACCOUNTING_PATTERNS.REVENUE_RECOGNITION.lines[1].accountCode,
        type: LINE_TYPE.CREDIT,
        amountCents,
        description: 'Recognize subscription revenue',
      },
    ],
    createdById,
    tx,
  });
}

/**
 * Create reversal journal entry (Pattern 4)
 * For voided invoices - reverses the original entry
 */
export async function createReversalJournalEntry({
  organizationId,
  originalEntryId,
  invoiceId,
  totalCents,
  createdById = null,
  tx,
}) {
  const periodMonth = getPeriodMonth(new Date());
  
  // Get the original entry
  const originalEntry = await tx.journalEntry.findUnique({
    where: { id: originalEntryId },
  });
  
  if (!originalEntry) {
    throw new AccountingError('Original journal entry not found');
  }
  
  if (originalEntry.status === JOURNAL_STATUS.REVERSED) {
    throw new AccountingError('Journal entry already reversed');
  }
  
  // Create reversal entry
  const reversalEntry = await createJournalEntry({
    organizationId,
    description: `Reversal of invoice ${invoiceId}`,
    sourceType: JOURNAL_SOURCE_TYPES.REVERSAL,
    sourceId: invoiceId,
    periodMonth,
    lines: [
      {
        accountCode: ACCOUNTING_PATTERNS.REVERSAL.lines[0].accountCode,
        type: LINE_TYPE.DEBIT,
        amountCents: totalCents,
        description: 'Reverse deferred revenue',
      },
      {
        accountCode: ACCOUNTING_PATTERNS.REVERSAL.lines[1].accountCode,
        type: LINE_TYPE.CREDIT,
        amountCents: totalCents,
        description: 'Reverse accounts receivable',
      },
    ],
    createdById,
    tx,
  });
  
  // Link the reversal to its source and mark the original as reversed.
  await tx.journalEntry.update({
    where: { id: reversalEntry.id },
    data: {
      reversal_of_id: originalEntryId,
    },
  });

  await tx.journalEntry.update({
    where: { id: originalEntryId },
    data: {
      status: JOURNAL_STATUS.REVERSED,
    },
  });
  
  logger.info('Journal entry reversed', {
    organizationId,
    originalEntryId,
    reversalEntryId: reversalEntry.id,
    invoiceId,
  });
  
  return reversalEntry;
}

/**
 * Get journal entries for a source
 * @param {string} organizationId - Organization ID
 * @param {string} sourceType - Source type
 * @param {string} sourceId - Source ID
 * @returns {Promise<Array>} Journal entries
 */
export async function getJournalEntriesBySource(organizationId, sourceType, sourceId) {
  return await prisma.journalEntry.findMany({
    where: {
      organization_id: organizationId,
      source_type: sourceType,
      source_id: sourceId,
    },
    include: {
      lines: {
        include: {
          account: true,
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });
}

/**
 * Get journal entry by ID with lines
 * @param {string} organizationId - Organization ID
 * @param {string} entryId - Journal entry ID
 * @returns {Promise<Object>} Journal entry with lines
 */
export async function getJournalEntry(organizationId, entryId) {
  const entry = await prisma.journalEntry.findFirst({
    where: {
      id: entryId,
      organization_id: organizationId,
    },
    include: {
      lines: {
        include: {
          account: true,
        },
      },
      created_by: {
        select: { id: true, name: true, email: true },
      },
    },
  });
  
  if (!entry) {
    throw new NotFoundError('Journal entry');
  }
  
  return entry;
}

/**
 * Get paginated journal entries for an organization
 * @param {string} organizationId - Organization ID
 * @param {Object} filters - Filters (sourceType, fromDate, toDate)
 * @param {Object} pagination - Pagination params
 * @returns {Promise<Object>} Paginated journal entries
 */
export async function getJournalEntries(organizationId, filters = {}, pagination = {}) {
  const { sourceType, fromDate, toDate } = filters;
  const { limit = 20, cursor = null } = pagination;
  
  const where = {
    organization_id: organizationId,
  };
  
  if (sourceType) {
    where.source_type = sourceType;
  }
  
  if (fromDate) {
    where.posted_at = { gte: fromDate };
  }
  
  if (toDate) {
    where.posted_at = { ...where.posted_at, lte: toDate };
  }
  
  if (cursor) {
    where.id = { gt: cursor };
  }
  
  const entries = await prisma.journalEntry.findMany({
    where,
    include: {
      lines: {
        include: {
          account: true,
        },
      },
    },
    orderBy: { posted_at: 'desc' },
    take: limit + 1,
  });
  
  const hasNextPage = entries.length > limit;
  const data = hasNextPage ? entries.slice(0, limit) : entries;
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

export default {
  createJournalEntry,
  createInvoiceJournalEntry,
  createPaymentJournalEntry,
  createRecognitionJournalEntry,
  createReversalJournalEntry,
  getJournalEntriesBySource,
  getJournalEntry,
  getJournalEntries,
};
