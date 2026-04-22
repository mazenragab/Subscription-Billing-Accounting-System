import { prisma } from '../../config/database.js';
import logger from '../../shared/utils/logger.js';
import Money from '../../shared/utils/money.js';
import { ValidationError, ConflictError } from '../../shared/errors/index.js';
import { createPaymentJournalEntry } from '../../accounting/journal.service.js';
import {
  getPaymentById,
  getPaymentByIdempotencyKey,
  listPayments,
  createPayment,
  getCustomerPaymentSummary,
  getPaymentStats,
  savePaymentMethod,
  getCustomerPaymentMethods,
  getDefaultPaymentMethod,
  deletePaymentMethod,
  getPaymentAttempts,
} from './payments.repository.js';
import { getInvoiceById, updateInvoiceStatus } from '../invoices/invoices.repository.js';
import { getCustomerById } from '../customers/customers.repository.js';

/**
 * Payments Service
 * Handles business logic for payment processing
 */

/**
 * Process payment for invoice
 * @param {string} organizationId - Organization ID
 * @param {string} invoiceId - Invoice ID
 * @param {Object} data - Payment data
 * @param {string} userId - User ID processing payment
 * @returns {Promise<Object>} Processed payment
 */
export async function processPayment(organizationId, invoiceId, data, userId) {
  // Check idempotency
  const existingPayment = await getPaymentByIdempotencyKey(organizationId, data.idempotency_key);
  if (existingPayment) {
    logger.info('Idempotent payment request', {
      organizationId,
      idempotencyKey: data.idempotency_key,
      existingPaymentId: existingPayment.id,
    });
    return existingPayment;
  }
  
  // Get invoice
  const invoice = await getInvoiceById(organizationId, invoiceId);
  
  if (invoice.status !== 'ISSUED') {
    throw new ValidationError(`Cannot process payment for invoice with status: ${invoice.status}`);
  }
  
  // Get customer
  const customer = await getCustomerById(organizationId, invoice.customer_id);
  
  // Calculate payment validation
  const totalPaid = invoice.payments.reduce((sum, p) => Money.add(sum, p.amount_cents), 0);
  const remainingAmount = Money.subtract(invoice.total_cents, totalPaid);
  
  if (data.amount_cents > remainingAmount) {
    throw new ValidationError(`Payment amount exceeds remaining balance. Remaining: ${Money.toDollars(remainingAmount)}`);
  }
  
  // Process payment in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create payment record
    const payment = await createPayment(organizationId, {
      invoice_id: invoiceId,
      customer_id: customer.id,
      amount_cents: data.amount_cents,
      method: data.method,
      reference: data.reference,
      idempotency_key: data.idempotency_key,
      paid_at: data.paid_at || new Date(),
    }, tx);
    
    // Create journal entry (Pattern 2: DR Cash, CR Accounts Receivable)
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
  
  logger.info('Payment processed', {
    organizationId,
    invoiceId,
    paymentId: result.payment.id,
    amountCents: data.amount_cents,
    method: data.method,
    userId,
  });
  
  return result.payment;
}

/**
 * Get payment details
 * @param {string} organizationId - Organization ID
 * @param {string} paymentId - Payment ID
 * @returns {Promise<Object>} Payment details
 */
export async function getPaymentDetails(organizationId, paymentId) {
  const payment = await getPaymentById(organizationId, paymentId);
  
  // Get payment attempts for the related invoice
  const attempts = await getPaymentAttempts(organizationId, payment.invoice_id);
  
  return {
    ...payment,
    payment_attempts: attempts,
  };
}

/**
 * List payments with filters
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Payments with pagination
 */
export async function listPaymentsService(organizationId, query) {
  const { limit, cursor, customer_id, invoice_id, method, from_date, to_date } = query;
  
  const filters = {};
  if (customer_id) filters.customer_id = customer_id;
  if (invoice_id) filters.invoice_id = invoice_id;
  if (method) filters.method = method;
  if (from_date) filters.from_date = from_date;
  if (to_date) filters.to_date = to_date;
  
  const pagination = { limit, cursor };
  
  return await listPayments(organizationId, filters, pagination);
}

/**
 * Get customer payment summary
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object>} Payment summary
 */
export async function getCustomerPaymentSummaryService(organizationId, customerId) {
  await getCustomerById(organizationId, customerId);
  return await getCustomerPaymentSummary(organizationId, customerId);
}

/**
 * Get payment statistics
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters (from_date, to_date)
 * @returns {Promise<Object>} Payment statistics
 */
export async function getPaymentStatistics(organizationId, query) {
  const { from_date, to_date } = query;
  
  const fromDate = from_date ? new Date(from_date) : new Date(new Date().getFullYear(), 0, 1);
  const toDate = to_date ? new Date(to_date) : new Date();
  
  return await getPaymentStats(organizationId, fromDate, toDate);
}

/**
 * Save payment method for customer
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {Object} data - Payment method data
 * @param {string} userId - User ID saving payment method
 * @returns {Promise<Object>} Saved payment method
 */
export async function savePaymentMethodService(organizationId, customerId, data, userId) {
  await getCustomerById(organizationId, customerId);
  
  const paymentMethod = await savePaymentMethod(organizationId, customerId, data);
  
  logger.info('Payment method saved', {
    organizationId,
    customerId,
    paymentMethodId: paymentMethod.id,
    type: data.type,
    userId,
  });
  
  return paymentMethod;
}

/**
 * Get customer payment methods
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<Array>} Payment methods
 */
export async function getCustomerPaymentMethodsService(organizationId, customerId) {
  await getCustomerById(organizationId, customerId);
  return await getCustomerPaymentMethods(organizationId, customerId);
}

/**
 * Delete payment method
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {string} paymentMethodId - Payment method ID
 * @param {string} userId - User ID deleting payment method
 * @returns {Promise<boolean>} Success status
 */
export async function deletePaymentMethodService(organizationId, customerId, paymentMethodId, userId) {
  await deletePaymentMethod(organizationId, customerId, paymentMethodId);
  
  logger.info('Payment method deleted', {
    organizationId,
    customerId,
    paymentMethodId,
    userId,
  });
  
  return true;
}

/**
 * Get payment attempts for invoice
 * @param {string} organizationId - Organization ID
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Array>} Payment attempts
 */
export async function getPaymentAttemptsService(organizationId, invoiceId) {
  await getInvoiceById(organizationId, invoiceId);
  return await getPaymentAttempts(organizationId, invoiceId);
}

/**
 * Simulate payment gateway webhook (for testing)
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Webhook data
 * @returns {Promise<Object>} Webhook result
 */
export async function simulatePaymentWebhook(organizationId, data) {
  const { payment_id, status, transaction_id } = data;
  
  const payment = await getPaymentById(organizationId, payment_id);
  
  if (!payment) {
    throw new ValidationError('Payment not found');
  }
  
  // In production, this would update payment status from gateway
  logger.info('Payment webhook received', {
    organizationId,
    paymentId: payment_id,
    status,
    transactionId: transaction_id,
  });
  
  return {
    received: true,
    payment_id,
    status,
    transaction_id,
  };
}

export default {
  processPayment,
  getPaymentDetails,
  listPaymentsService,
  getCustomerPaymentSummaryService,
  getPaymentStatistics,
  savePaymentMethodService,
  getCustomerPaymentMethodsService,
  deletePaymentMethodService,
  getPaymentAttemptsService,
  simulatePaymentWebhook,
};