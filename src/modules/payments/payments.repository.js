import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../shared/errors/index.js';

/**
 * Payments Repository
 * Handles database operations for payments and payment methods
 */

/**
 * Get payment by ID with tenant isolation
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
          customer_email: true,
          status: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      journal_entry: {
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
      },
    },
  });
  
  if (!payment) {
    throw new NotFoundError('Payment');
  }
  
  return payment;
}

/**
 * Get payment by idempotency key
 * @param {string} organizationId - Organization ID
 * @param {string} idempotencyKey - Idempotency key
 * @returns {Promise<Object|null>} Payment or null
 */
export async function getPaymentByIdempotencyKey(organizationId, idempotencyKey) {
  return await prisma.payment.findFirst({
    where: {
      organization_id: organizationId,
      idempotency_key: idempotencyKey,
    },
  });
}

/**
 * List payments with pagination and filters
 * @param {string} organizationId - Organization ID
 * @param {Object} filters - Filters (customer_id, invoice_id, method, from_date, to_date)
 * @param {Object} pagination - Pagination params
 * @returns {Promise<Object>} Payments with pagination
 */
export async function listPayments(organizationId, filters = {}, pagination = {}) {
  const { customer_id, invoice_id, method, from_date, to_date } = filters;
  const { limit = 20, cursor = null } = pagination;
  
  const where = {
    organization_id: organizationId,
  };
  
  if (customer_id) {
    where.customer_id = customer_id;
  }
  
  if (invoice_id) {
    where.invoice_id = invoice_id;
  }
  
  if (method) {
    where.method = method;
  }
  
  if (from_date) {
    where.paid_at = { gte: from_date };
  }
  
  if (to_date) {
    where.paid_at = { ...where.paid_at, lte: to_date };
  }
  
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
          total_cents: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
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
 * Get customer payment summary
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object>} Payment summary
 */
export async function getCustomerPaymentSummary(organizationId, customerId) {
  const payments = await prisma.payment.findMany({
    where: {
      organization_id: organizationId,
      customer_id: customerId,
    },
    select: {
      amount_cents: true,
      paid_at: true,
    },
  });
  
  const totalPaid = payments.reduce((sum, p) => sum + p.amount_cents, 0);
  const lastPayment = payments.length > 0 
    ? payments.reduce((latest, p) => p.paid_at > latest.paid_at ? p : latest, payments[0])
    : null;
  
  return {
    total_paid_cents: totalPaid,
    payment_count: payments.length,
    last_payment_at: lastPayment?.paid_at || null,
    last_payment_amount_cents: lastPayment?.amount_cents || 0,
  };
}

/**
 * Get payment statistics for organization
 * @param {string} organizationId - Organization ID
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Promise<Object>} Payment statistics
 */
export async function getPaymentStats(organizationId, fromDate, toDate) {
  const stats = await prisma.payment.aggregate({
    where: {
      organization_id: organizationId,
      paid_at: {
        gte: fromDate,
        lte: toDate,
      },
    },
    _sum: {
      amount_cents: true,
    },
    _count: true,
    _avg: {
      amount_cents: true,
    },
  });
  
  // Get payments by method
  const byMethod = await prisma.payment.groupBy({
    by: ['method'],
    where: {
      organization_id: organizationId,
      paid_at: {
        gte: fromDate,
        lte: toDate,
      },
    },
    _sum: {
      amount_cents: true,
    },
    _count: true,
  });
  
  return {
    total_amount_cents: stats._sum.amount_cents || 0,
    total_count: stats._count,
    average_amount_cents: Math.round(stats._avg.amount_cents || 0),
    by_method: byMethod,
  };
}

/**
 * Save payment method for customer
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {Object} data - Payment method data
 * @returns {Promise<Object>} Saved payment method
 */
export async function savePaymentMethod(organizationId, customerId, data) {
  // If this is default, unset other defaults
  if (data.is_default) {
    await prisma.paymentMethod.updateMany({
      where: {
        organization_id: organizationId,
        customer_id: customerId,
        is_default: true,
      },
      data: { is_default: false },
    });
  }
  
  return await prisma.paymentMethod.create({
    data: {
      organization_id: organizationId,
      customer_id: customerId,
      type: data.type,
      last4: data.last4,
      expiry_month: data.expiry_month,
      expiry_year: data.expiry_year,
      holder_name: data.holder_name,
      is_default: data.is_default || false,
    },
  });
}

/**
 * Get customer payment methods
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<Array>} Payment methods
 */
export async function getCustomerPaymentMethods(organizationId, customerId) {
  return await prisma.paymentMethod.findMany({
    where: {
      organization_id: organizationId,
      customer_id: customerId,
      is_deleted: false,
    },
    orderBy: [
      { is_default: 'desc' },
      { created_at: 'desc' },
    ],
  });
}

/**
 * Get default payment method for customer
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object|null>} Default payment method or null
 */
export async function getDefaultPaymentMethod(organizationId, customerId) {
  return await prisma.paymentMethod.findFirst({
    where: {
      organization_id: organizationId,
      customer_id: customerId,
      is_default: true,
      is_deleted: false,
    },
  });
}

/**
 * Delete payment method
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {string} paymentMethodId - Payment method ID
 * @returns {Promise<boolean>} Success status
 */
export async function deletePaymentMethod(organizationId, customerId, paymentMethodId) {
  const paymentMethod = await prisma.paymentMethod.findFirst({
    where: {
      id: paymentMethodId,
      organization_id: organizationId,
      customer_id: customerId,
    },
  });
  
  if (!paymentMethod) {
    throw new NotFoundError('Payment method');
  }
  
  await prisma.paymentMethod.update({
    where: { id: paymentMethodId },
    data: { is_deleted: true },
  });
  
  return true;
}

/**
 * Get payment attempts for invoice
 * @param {string} organizationId - Organization ID
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Array>} Payment attempts
 */
export async function getPaymentAttempts(organizationId, invoiceId) {
  return await prisma.paymentAttempt.findMany({
    where: {
      organization_id: organizationId,
      invoice_id: invoiceId,
    },
    orderBy: { attempt_number: 'asc' },
  });
}

export default {
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
};