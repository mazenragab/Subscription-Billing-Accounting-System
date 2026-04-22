import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../shared/errors/index.js';

/**
 * Invoices Repository
 * Handles database operations for invoices
 */

/**
 * Get invoice by ID with tenant isolation
 * @param {string} organizationId - Organization ID
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Object>} Invoice with relations
 */
export async function getInvoiceById(organizationId, invoiceId) {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      organization_id: organizationId,
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      subscription: {
        include: {
          plan: true,
        },
      },
      line_items: true,
      payments: true,
      payment_attempts: {
        orderBy: { attempt_number: 'asc' },
      },
    },
  });
  
  if (!invoice) {
    throw new NotFoundError('Invoice');
  }
  
  return invoice;
}

/**
 * Get invoice by number with tenant isolation
 * @param {string} organizationId - Organization ID
 * @param {string} invoiceNumber - Invoice number
 * @returns {Promise<Object|null>} Invoice or null
 */
export async function getInvoiceByNumber(organizationId, invoiceNumber) {
  return await prisma.invoice.findFirst({
    where: {
      organization_id: organizationId,
      invoice_number: invoiceNumber,
    },
  });
}

/**
 * List invoices with pagination and filters
 * @param {string} organizationId - Organization ID
 * @param {Object} filters - Filters (status, customer_id, subscription_id, from_date, to_date)
 * @param {Object} pagination - Pagination params
 * @returns {Promise<Object>} Invoices with pagination
 */
export async function listInvoices(organizationId, filters = {}, pagination = {}) {
  const { status, customer_id, subscription_id, from_date, to_date } = filters;
  const { limit = 20, cursor = null } = pagination;
  
  const where = {
    organization_id: organizationId,
  };
  
  if (status) {
    where.status = status;
  }
  
  if (customer_id) {
    where.customer_id = customer_id;
  }
  
  if (subscription_id) {
    where.subscription_id = subscription_id;
  }
  
  if (from_date) {
    where.created_at = { gte: from_date };
  }
  
  if (to_date) {
    where.created_at = { ...where.created_at, lte: to_date };
  }
  
  if (cursor) {
    where.id = { gt: cursor };
  }
  
  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      subscription: {
        include: {
          plan: true,
        },
      },
      line_items: true,
      payments: {
        select: {
          id: true,
          amount_cents: true,
          paid_at: true,
          method: true,
        },
      },
      _count: {
        select: {
          payment_attempts: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
    take: limit + 1,
  });
  
  const hasNextPage = invoices.length > limit;
  const data = hasNextPage ? invoices.slice(0, limit) : invoices;
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

/**
 * Generate next invoice number
 * @param {string} organizationId - Organization ID
 * @param {Object} tx - Prisma transaction client
 * @returns {Promise<string>} Next invoice number
 */
export async function generateNextInvoiceNumber(organizationId, tx) {
  const billingSettings = await tx.billingSettings.findUnique({
    where: { organization_id: organizationId },
  });
  
  if (!billingSettings) {
    throw new Error('Billing settings not found for organization');
  }
  
  const nextSequence = BigInt(billingSettings.invoice_sequence ?? 0) + 1n;
  const year = new Date().getFullYear();
  const paddedNumber = String(nextSequence).padStart(6, '0');
  const invoiceNumber = `${billingSettings.invoice_prefix}-${year}-${paddedNumber}`;
  
  // Update sequence
  await tx.billingSettings.update({
    where: { organization_id: organizationId },
    data: { invoice_sequence: nextSequence },
  });
  
  return invoiceNumber;
}

/**
 * Create invoice (DRAFT)
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Invoice data
 * @param {Array} lineItems - Line items data
 * @param {Object} tx - Prisma transaction client
 * @returns {Promise<Object>} Created invoice
 */
export async function createInvoice(organizationId, data, lineItems, tx) {
  const invoice = await tx.invoice.create({
    data: {
      organization_id: organizationId,
      customer_id: data.customer_id,
      subscription_id: data.subscription_id,
      invoice_number: data.invoice_number,
      status: 'DRAFT',
      subtotal_cents: data.subtotal_cents,
      discount_cents: data.discount_cents || 0,
      tax_cents: data.tax_cents || 0,
      total_cents: data.total_cents,
      currency: data.currency || 'USD',
      period_start: data.period_start,
      period_end: data.period_end,
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      notes: data.notes,
      line_items: {
        create: lineItems.map(item => ({
          organization_id: organizationId,
          description: item.description,
          quantity: item.quantity,
          unit_amount_cents: item.unit_amount_cents,
          amount_cents: item.amount_cents,
          plan_id: item.plan_id,
          plan_name: item.plan_name,
          period_start: item.period_start,
          period_end: item.period_end,
        })),
      },
    },
    include: {
      line_items: true,
    },
  });
  
  return invoice;
}

/**
 * Update invoice status
 * @param {string} invoiceId - Invoice ID
 * @param {string} status - New status
 * @param {Object} data - Additional update data
 * @param {Object} tx - Prisma transaction client
 * @returns {Promise<Object>} Updated invoice
 */
export async function updateInvoiceStatus(invoiceId, status, data = {}, tx) {
  return await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      status,
      ...data,
      updated_at: new Date(),
    },
    include: {
      line_items: true,
    },
  });
}

/**
 * Create payment record
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Payment data
 * @param {Object} tx - Prisma transaction client
 * @returns {Promise<Object>} Created payment
 */
export async function createPayment(organizationId, data, tx) {
  // Check for duplicate idempotency key
  const existing = await tx.payment.findFirst({
    where: {
      organization_id: organizationId,
      idempotency_key: data.idempotency_key,
    },
  });
  
  if (existing) {
    throw new ConflictError('Payment with this idempotency key already exists');
  }
  
  return await tx.payment.create({
    data: {
      organization_id: organizationId,
      invoice_id: data.invoice_id,
      customer_id: data.customer_id,
      amount_cents: data.amount_cents,
      currency: data.currency || 'USD',
      method: data.method,
      reference: data.reference,
      idempotency_key: data.idempotency_key,
      paid_at: data.paid_at || new Date(),
    },
  });
}

/**
 * Get invoice payments
 * @param {string} organizationId - Organization ID
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Array>} Payments
 */
export async function getInvoicePayments(organizationId, invoiceId) {
  await getInvoiceById(organizationId, invoiceId);
  
  return await prisma.payment.findMany({
    where: {
      invoice_id: invoiceId,
    },
    orderBy: { paid_at: 'desc' },
  });
}

/**
 * Get organization-wide payments with pagination
 * @param {string} organizationId - Organization ID
 * @param {Object} pagination - Pagination params
 * @returns {Promise<Object>} Payments with pagination
 */
export async function getOrganizationPayments(organizationId, { limit = 20, cursor = null }) {
  const where = {
    organization_id: organizationId,
  };
  
  if (cursor) {
    where.id = { gt: cursor };
  }
  
  const payments = await prisma.payment.findMany({
    where,
    include: {
      invoice: {
        select: {
          invoice_number: true,
          customer_name: true,
        },
      },
    },
    orderBy: { paid_at: 'desc' },
    take: limit + 1,
  });
  
  const hasNextPage = payments.length > limit;
  const data = hasNextPage ? payments.slice(0, limit) : payments;
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

/**
 * Get payment by ID
 * @param {string} organizationId - Organization ID
 * @param {string} paymentId - Payment ID
 * @returns {Promise<Object>} Payment with relations
 */
export async function getPaymentById(organizationId, paymentId) {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      organization_id: organizationId,
    },
    include: {
      invoice: {
        select: {
          id: true,
          invoice_number: true,
          total_cents: true,
          customer_name: true,
        },
      },
      journal_entry: true,
    },
  });
  
  if (!payment) {
    throw new NotFoundError('Payment');
  }
  
  return payment;
}

export default {
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
};
