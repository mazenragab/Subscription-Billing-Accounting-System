import { prisma } from '../../config/database.js';
import logger from '../../shared/utils/logger.js';
import Money from '../../shared/utils/money.js';
import { getPeriodMonth } from '../../shared/utils/date.js';
import { ValidationError, ConflictError } from '../../shared/errors/index.js';
import { createInvoiceJournalEntry, createPaymentJournalEntry, createReversalJournalEntry } from '../../accounting/journal.service.js';
import { createRecognitionSchedules, voidRecognitionSchedules } from '../../accounting/recognition.service.js';
import { scheduleInvoiceDunning } from '../../billing/dunning.job.js';
import {
  getInvoiceById,
  getInvoiceByNumber,
  listInvoices,
  generateNextInvoiceNumber,
  createInvoice,
  updateInvoiceStatus,
  createPayment,
  getInvoicePayments,
  getOrganizationPayments,
  getPaymentById,
} from './invoices.repository.js';
import { getCustomerById } from '../customers/customers.repository.js';
import { getSubscriptionById } from '../subscriptions/subscriptions.repository.js';

/**
 * Invoices Service
 * Handles business logic for invoice management
 */

/**
 * Create draft invoice
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Invoice data
 * @param {string} userId - User ID creating invoice
 * @returns {Promise<Object>} Created draft invoice
 */
export async function createDraftInvoice(organizationId, data, userId) {
  // Verify customer exists
  const customer = await getCustomerById(organizationId, data.customer_id);
  
  // Verify subscription exists
  const subscription = await getSubscriptionById(organizationId, data.subscription_id);
  
  // Calculate totals
  let subtotalCents = 0;
  for (const item of data.line_items) {
    subtotalCents = Money.add(subtotalCents, item.amount_cents);
  }
  
  const totalCents = subtotalCents;
  
  // Create invoice in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Generate invoice number (will be assigned when issued, not now)
    const invoiceNumber = `DRAFT-${Date.now()}`;
    
    const invoice = await createInvoice(organizationId, {
      customer_id: data.customer_id,
      subscription_id: data.subscription_id,
      invoice_number: invoiceNumber,
      subtotal_cents: subtotalCents,
      discount_cents: 0,
      tax_cents: 0,
      total_cents: totalCents,
      currency: 'USD',
      period_start: data.period_start,
      period_end: data.period_end,
      customer_name: customer.name,
      customer_email: customer.email,
      notes: data.notes,
    }, data.line_items, tx);
    
    return invoice;
  });
  
  logger.info('Draft invoice created', {
    organizationId,
    invoiceId: result.id,
    customerId: data.customer_id,
    totalCents,
    userId,
  });
  
  return result;
}

/**
 * Issue invoice (DRAFT → ISSUED)
 * Creates journal entry and recognition schedules
 * @param {string} organizationId - Organization ID
 * @param {string} invoiceId - Invoice ID
 * @param {Object} data - Issue data
 * @param {string} userId - User ID issuing invoice
 * @returns {Promise<Object>} Issued invoice
 */
export async function issueInvoice(organizationId, invoiceId, data, userId) {
  const invoice = await getInvoiceById(organizationId, invoiceId);
  
  if (invoice.status !== 'DRAFT') {
    throw new ValidationError(`Cannot issue invoice with status: ${invoice.status}`);
  }
  
  const result = await prisma.$transaction(async (tx) => {
    // Generate real invoice number
    const invoiceNumber = await generateNextInvoiceNumber(organizationId, tx);
    
    // Update invoice status to ISSUED
    const issuedAt = data.issued_at || new Date();
    const dueAt = data.due_at || new Date(issuedAt.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days default
    
    const updatedInvoice = await updateInvoiceStatus(invoiceId, 'ISSUED', {
      invoice_number: invoiceNumber,
      issued_at: issuedAt,
      due_at: dueAt,
    }, tx);
    
    // Create journal entry (Pattern 1: DR AR, CR Deferred Revenue)
    const periodMonth = getPeriodMonth(issuedAt);
    const journalEntry = await createInvoiceJournalEntry({
      organizationId,
      invoiceId: invoice.id,
      totalCents: invoice.total_cents,
      createdById: userId,
      tx,
    });
    
    // Create revenue recognition schedules
    await createRecognitionSchedules({
      organizationId,
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription_id,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      totalCents: invoice.total_cents,
      tx,
    });
    
    return { invoice: updatedInvoice, journalEntry };
  });
  
  logger.info('Invoice issued', {
    organizationId,
    invoiceId,
    invoiceNumber: result.invoice.invoice_number,
    totalCents: invoice.total_cents,
    userId,
  });
  
  return result.invoice;
}

/**
 * Void invoice (ISSUED → VOID)
 * Creates reversal journal entry
 * @param {string} organizationId - Organization ID
 * @param {string} invoiceId - Invoice ID
 * @param {string} userId - User ID voiding invoice
 * @returns {Promise<Object>} Voided invoice
 */
export async function voidInvoice(organizationId, invoiceId, userId) {
  const invoice = await getInvoiceById(organizationId, invoiceId);
  
  if (invoice.status !== 'ISSUED') {
    throw new ValidationError(`Cannot void invoice with status: ${invoice.status}`);
  }
  
  const result = await prisma.$transaction(async (tx) => {
    // Get the journal entry for this invoice
    const journalEntry = await tx.journalEntry.findFirst({
      where: {
        source_type: 'INVOICE',
        source_id: invoiceId,
        status: 'POSTED',
      },
    });
    
    if (!journalEntry) {
      throw new ValidationError('No journal entry found for this invoice');
    }
    
    // Create reversal journal entry (Pattern 4)
    const reversalEntry = await createReversalJournalEntry({
      organizationId,
      originalEntryId: journalEntry.id,
      invoiceId: invoice.id,
      totalCents: invoice.total_cents,
      createdById: userId,
      tx,
    });
    
    // Void recognition schedules
    await voidRecognitionSchedules({
      organizationId,
      invoiceId: invoice.id,
      tx,
    });
    
    // Update invoice status to VOID
    const updatedInvoice = await updateInvoiceStatus(invoiceId, 'VOID', {
      voided_at: new Date(),
    }, tx);
    
    return { invoice: updatedInvoice, reversalEntry };
  });
  
  logger.info('Invoice voided', {
    organizationId,
    invoiceId,
    invoiceNumber: invoice.invoice_number,
    totalCents: invoice.total_cents,
    userId,
  });
  
  return result.invoice;
}

/**
 * Mark invoice as uncollectible
 * @param {string} organizationId - Organization ID
 * @param {string} invoiceId - Invoice ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated invoice
 */
export async function markInvoiceUncollectible(organizationId, invoiceId, userId) {
  const invoice = await getInvoiceById(organizationId, invoiceId);
  
  if (invoice.status !== 'ISSUED') {
    throw new ValidationError(`Cannot mark invoice as uncollectible with status: ${invoice.status}`);
  }
  
  const updatedInvoice = await updateInvoiceStatus(invoiceId, 'UNCOLLECTIBLE', {
    voided_at: new Date(),
  });
  
  logger.info('Invoice marked as uncollectible', {
    organizationId,
    invoiceId,
    userId,
  });
  
  return updatedInvoice;
}

/**
 * Record payment for invoice
 * @param {string} organizationId - Organization ID
 * @param {string} invoiceId - Invoice ID
 * @param {Object} data - Payment data
 * @param {string} userId - User ID recording payment
 * @returns {Promise<Object>} Payment record
 */
export async function recordPayment(organizationId, invoiceId, data, userId) {
  const invoice = await getInvoiceById(organizationId, invoiceId);
  
  if (invoice.status !== 'ISSUED') {
    throw new ValidationError(`Cannot record payment for invoice with status: ${invoice.status}`);
  }
  
  // Validate payment amount
  const totalPaid = invoice.payments.reduce((sum, p) => Money.add(sum, p.amount_cents), 0);
  const remainingAmount = Money.subtract(invoice.total_cents, totalPaid);
  
  if (data.amount_cents > remainingAmount) {
    throw new ValidationError(`Payment amount exceeds remaining balance. Remaining: ${Money.toDollars(remainingAmount)}`);
  }
  
  const result = await prisma.$transaction(async (tx) => {
    // Create payment record
    const payment = await createPayment(organizationId, {
      invoice_id: invoiceId,
      customer_id: invoice.customer_id,
      amount_cents: data.amount_cents,
      method: data.method,
      reference: data.reference,
      idempotency_key: data.idempotency_key,
      paid_at: data.paid_at || new Date(),
    }, tx);
    
    // Create journal entry (Pattern 2: DR Cash, CR AR)
    const journalEntry = await createPaymentJournalEntry({
      organizationId,
      paymentId: payment.id,
      amountCents: data.amount_cents,
      createdById: userId,
      tx,
    });
    
    // Link journal entry to payment
    await tx.payment.update({
      where: { id: payment.id },
      data: { journal_entry_id: journalEntry.id },
    });
    
    // Check if invoice is fully paid
    const newTotalPaid = Money.add(totalPaid, data.amount_cents);
    
    if (newTotalPaid >= invoice.total_cents) {
      // Invoice fully paid
      await updateInvoiceStatus(invoiceId, 'PAID', {
        paid_at: new Date(),
      }, tx);
    }
    
    return { payment, journalEntry };
  });
  
  logger.info('Payment recorded', {
    organizationId,
    invoiceId,
    paymentId: result.payment.id,
    amountCents: data.amount_cents,
    userId,
  });
  
  return result.payment;
}

/**
 * Get invoice with details
 * @param {string} organizationId - Organization ID
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Object>} Invoice with details
 */
export async function getInvoiceDetails(organizationId, invoiceId) {
  const invoice = await getInvoiceById(organizationId, invoiceId);
  
  // Calculate payment summary
  const totalPaid = invoice.payments.reduce((sum, p) => Money.add(sum, p.amount_cents), 0);
  const remainingAmount = Money.subtract(invoice.total_cents, totalPaid);
  
  return {
    ...invoice,
    payment_summary: {
      total_paid_cents: totalPaid,
      remaining_cents: remainingAmount,
      is_fully_paid: remainingAmount === 0,
      payment_count: invoice.payments.length,
    },
  };
}

/**
 * List invoices with filters
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Invoices with pagination
 */
export async function listInvoicesService(organizationId, query) {
  const { limit, cursor, status, customer_id, subscription_id, from_date, to_date } = query;
  
  const filters = {};
  if (status) filters.status = status;
  if (customer_id) filters.customer_id = customer_id;
  if (subscription_id) filters.subscription_id = subscription_id;
  if (from_date) filters.from_date = from_date;
  if (to_date) filters.to_date = to_date;
  
  const pagination = { limit, cursor };
  
  return await listInvoices(organizationId, filters, pagination);
}

/**
 * Get invoice journal entries
 * @param {string} organizationId - Organization ID
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Array>} Journal entries
 */
export async function getInvoiceJournalEntries(organizationId, invoiceId) {
  await getInvoiceById(organizationId, invoiceId);
  
  const journalEntries = await prisma.journalEntry.findMany({
    where: {
      organization_id: organizationId,
      source_id: invoiceId,
      source_type: { in: ['INVOICE', 'REVERSAL'] },
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
  
  return journalEntries;
}

/**
 * Get invoice payments
 * @param {string} organizationId - Organization ID
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Array>} Payments
 */
export async function getInvoicePaymentsService(organizationId, invoiceId) {
  return await getInvoicePayments(organizationId, invoiceId);
}

/**
 * Get organization payments
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Payments with pagination
 */
export async function getOrganizationPaymentsService(organizationId, query) {
  const { limit, cursor } = query;
  return await getOrganizationPayments(organizationId, { limit, cursor });
}

/**
 * Get payment by ID
 * @param {string} organizationId - Organization ID
 * @param {string} paymentId - Payment ID
 * @returns {Promise<Object>} Payment details
 */
export async function getPaymentDetails(organizationId, paymentId) {
  return await getPaymentById(organizationId, paymentId);
}

export default {
  createDraftInvoice,
  issueInvoice,
  voidInvoice,
  markInvoiceUncollectible,
  recordPayment,
  getInvoiceDetails,
  listInvoicesService,
  getInvoiceJournalEntries,
  getInvoicePaymentsService,
  getOrganizationPaymentsService,
  getPaymentDetails,
};