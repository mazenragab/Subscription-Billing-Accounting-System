import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../shared/errors/index.js';

/**
 * Customers Repository
 * Handles database operations for customers
 */

/**
 * Get customer by ID with tenant isolation
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object>} Customer with relations
 */
export async function getCustomerById(organizationId, customerId) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      organization_id: organizationId,
      deleted_at: null,
    },
    include: {
      billing_info: true,
      subscriptions: {
        where: {
          status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
        },
        include: {
          plan: true,
        },
        orderBy: { created_at: 'desc' },
      },
    },
  });
  
  if (!customer) {
    throw new NotFoundError('Customer');
  }
  
  return customer;
}

/**
 * Get customer by email with tenant isolation
 * @param {string} organizationId - Organization ID
 * @param {string} email - Customer email
 * @returns {Promise<Object|null>} Customer or null
 */
export async function getCustomerByEmail(organizationId, email) {
  return await prisma.customer.findFirst({
    where: {
      organization_id: organizationId,
      email,
      deleted_at: null,
    },
  });
}

/**
 * Get customer by external ID with tenant isolation
 * @param {string} organizationId - Organization ID
 * @param {string} externalId - External ID
 * @returns {Promise<Object|null>} Customer or null
 */
export async function getCustomerByExternalId(organizationId, externalId) {
  if (!externalId) return null;
  
  return await prisma.customer.findFirst({
    where: {
      organization_id: organizationId,
      external_id: externalId,
      deleted_at: null,
    },
  });
}

/**
 * List customers with pagination and filters
 * @param {string} organizationId - Organization ID
 * @param {Object} filters - Filters (status, search)
 * @param {Object} pagination - Pagination params
 * @returns {Promise<Object>} Customers with pagination
 */
export async function listCustomers(organizationId, filters = {}, pagination = {}) {
  const { status, search } = filters;
  const { limit = 20, cursor = null } = pagination;
  
  const where = {
    organization_id: organizationId,
    deleted_at: null,
  };
  
  if (status) {
    where.status = status;
  }
  
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { external_id: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  if (cursor) {
    where.id = { gt: cursor };
  }
  
  const customers = await prisma.customer.findMany({
    where,
    include: {
      billing_info: true,
      _count: {
        select: {
          subscriptions: {
            where: {
              status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
            },
          },
          invoices: {
            where: {
              status: { in: ['ISSUED', 'PAID'] },
            },
          },
        },
      },
    },
    orderBy: { created_at: 'desc' },
    take: limit + 1,
  });
  
  const hasNextPage = customers.length > limit;
  const data = hasNextPage ? customers.slice(0, limit) : customers;
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
 * Create customer
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Customer data
 * @returns {Promise<Object>} Created customer
 */
export async function createCustomer(organizationId, data) {
  // Check for duplicate email
  const existing = await getCustomerByEmail(organizationId, data.email);
  if (existing) {
    throw new ConflictError(`Customer with email "${data.email}" already exists`);
  }
  
  // Check for duplicate external ID
  if (data.external_id) {
    const existingExt = await getCustomerByExternalId(organizationId, data.external_id);
    if (existingExt) {
      throw new ConflictError(`Customer with external ID "${data.external_id}" already exists`);
    }
  }
  
  return await prisma.customer.create({
    data: {
      organization_id: organizationId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      external_id: data.external_id,
      notes: data.notes,
      status: 'ACTIVE',
    },
    include: {
      billing_info: true,
    },
  });
}

/**
 * Update customer
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated customer
 */
export async function updateCustomer(organizationId, customerId, data) {
  // Verify customer exists
  await getCustomerById(organizationId, customerId);
  
  // Check for duplicate email if changing
  if (data.email) {
    const existing = await prisma.customer.findFirst({
      where: {
        organization_id: organizationId,
        email: data.email,
        id: { not: customerId },
        deleted_at: null,
      },
    });
    
    if (existing) {
      throw new ConflictError(`Customer with email "${data.email}" already exists`);
    }
  }
  
  // Check for duplicate external ID if changing
  if (data.external_id) {
    const existing = await prisma.customer.findFirst({
      where: {
        organization_id: organizationId,
        external_id: data.external_id,
        id: { not: customerId },
        deleted_at: null,
      },
    });
    
    if (existing) {
      throw new ConflictError(`Customer with external ID "${data.external_id}" already exists`);
    }
  }
  
  return await prisma.customer.update({
    where: { id: customerId },
    data: {
      ...data,
      updated_at: new Date(),
    },
    include: {
      billing_info: true,
    },
  });
}

/**
 * Soft delete customer
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteCustomer(organizationId, customerId) {
  await getCustomerById(organizationId, customerId);
  
  // Check for active subscriptions
  const activeSubscriptions = await prisma.subscription.count({
    where: {
      customer_id: customerId,
      status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
    },
  });
  
  if (activeSubscriptions > 0) {
    throw new ConflictError('Cannot delete customer with active subscriptions. Cancel subscriptions first.');
  }
  
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      deleted_at: new Date(),
      updated_at: new Date(),
    },
  });
  
  return true;
}

/**
 * Get customer billing info
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object|null>} Billing info
 */
export async function getCustomerBillingInfo(organizationId, customerId) {
  await getCustomerById(organizationId, customerId);
  
  return await prisma.customerBillingInfo.findUnique({
    where: { customer_id: customerId },
  });
}

/**
 * Create or update customer billing info
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {Object} data - Billing info data
 * @returns {Promise<Object>} Billing info
 */
export async function upsertCustomerBillingInfo(organizationId, customerId, data) {
  await getCustomerById(organizationId, customerId);
  
  return await prisma.customerBillingInfo.upsert({
    where: { customer_id: customerId },
    update: {
      ...data,
      updated_at: new Date(),
    },
    create: {
      customer_id: customerId,
      organization_id: organizationId,
      ...data,
    },
  });
}

/**
 * Get customer subscriptions
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {Object} pagination - Pagination params
 * @returns {Promise<Object>} Subscriptions with pagination
 */
export async function getCustomerSubscriptions(organizationId, customerId, { limit = 20, cursor = null }) {
  await getCustomerById(organizationId, customerId);
  
  const where = {
    customer_id: customerId,
  };
  
  if (cursor) {
    where.id = { gt: cursor };
  }
  
  const subscriptions = await prisma.subscription.findMany({
    where,
    include: {
      plan: true,
      organization: {
        select: {
          billing_settings: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
    take: limit + 1,
  });
  
  const hasNextPage = subscriptions.length > limit;
  const data = hasNextPage ? subscriptions.slice(0, limit) : subscriptions;
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
 * Get customer invoices
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {Object} pagination - Pagination params
 * @param {Object} filters - Filters (status)
 * @returns {Promise<Object>} Invoices with pagination
 */
export async function getCustomerInvoices(organizationId, customerId, { limit = 20, cursor = null }, filters = {}) {
  await getCustomerById(organizationId, customerId);
  
  const where = {
    customer_id: customerId,
  };
  
  if (filters.status) {
    where.status = filters.status;
  }
  
  if (cursor) {
    where.id = { gt: cursor };
  }
  
  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      line_items: true,
      payments: true,
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
 * Get customer payments
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {Object} pagination - Pagination params
 * @returns {Promise<Object>} Payments with pagination
 */
export async function getCustomerPayments(organizationId, customerId, { limit = 20, cursor = null }) {
  await getCustomerById(organizationId, customerId);
  
  const where = {
    customer_id: customerId,
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
          total_cents: true,
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
 * Get customer balance (unpaid invoices total)
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<number>} Balance in cents
 */
export async function getCustomerBalance(organizationId, customerId) {
  await getCustomerById(organizationId, customerId);
  
  const result = await prisma.invoice.aggregate({
    where: {
      customer_id: customerId,
      status: 'ISSUED',
    },
    _sum: {
      total_cents: true,
    },
  });
  
  return result._sum.total_cents || 0;
}

export default {
  getCustomerById,
  getCustomerByEmail,
  getCustomerByExternalId,
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerBillingInfo,
  upsertCustomerBillingInfo,
  getCustomerSubscriptions,
  getCustomerInvoices,
  getCustomerPayments,
  getCustomerBalance,
};