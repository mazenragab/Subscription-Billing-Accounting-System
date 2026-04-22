import logger from '../../shared/utils/logger.js';
import { ForbiddenError } from '../../shared/errors/index.js';
import {
  getCustomerById,
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
} from './customers.repository.js';

/**
 * Customers Service
 * Handles business logic for customer management
 */

/**
 * Get customer by ID
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object>} Customer with relations
 */
export async function getCustomer(organizationId, customerId) {
  const customer = await getCustomerById(organizationId, customerId);
  
  // Get additional stats
  const balance = await getCustomerBalance(organizationId, customerId);
  
  return {
    ...customer,
    balance_cents: balance,
  };
}

/**
 * List customers with filters
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Customers with pagination
 */
export async function listCustomersService(organizationId, query) {
  const { limit, cursor, status, search } = query;
  
  const filters = {};
  if (status) filters.status = status;
  if (search) filters.search = search;
  
  const pagination = { limit, cursor };
  
  return await listCustomers(organizationId, filters, pagination);
}

/**
 * Create new customer
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Customer data
 * @param {string} userId - User ID creating customer
 * @returns {Promise<Object>} Created customer
 */
export async function createCustomerService(organizationId, data, userId) {
  const customer = await createCustomer(organizationId, data);
  
  logger.info('Customer created', {
    organizationId,
    customerId: customer.id,
    email: customer.email,
    userId,
  });
  
  return customer;
}

/**
 * Update customer
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {Object} data - Update data
 * @param {string} userId - User ID updating customer
 * @returns {Promise<Object>} Updated customer
 */
export async function updateCustomerService(organizationId, customerId, data, userId) {
  const customer = await updateCustomer(organizationId, customerId, data);
  
  logger.info('Customer updated', {
    organizationId,
    customerId,
    userId,
    updates: Object.keys(data),
  });
  
  return customer;
}

/**
 * Delete customer (soft delete)
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {string} userId - User ID deleting customer
 * @returns {Promise<boolean>} Success status
 */
export async function deleteCustomerService(organizationId, customerId, userId) {
  await deleteCustomer(organizationId, customerId);
  
  logger.info('Customer deleted', {
    organizationId,
    customerId,
    userId,
  });
  
  return true;
}

/**
 * Get customer billing info
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object>} Billing info
 */
export async function getCustomerBillingInfoService(organizationId, customerId) {
  return await getCustomerBillingInfo(organizationId, customerId);
}

/**
 * Update customer billing info
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {Object} data - Billing info data
 * @param {string} userId - User ID updating billing info
 * @returns {Promise<Object>} Updated billing info
 */
export async function updateCustomerBillingInfoService(organizationId, customerId, data, userId) {
  const billingInfo = await upsertCustomerBillingInfo(organizationId, customerId, data);
  
  logger.info('Customer billing info updated', {
    organizationId,
    customerId,
    userId,
  });
  
  return billingInfo;
}

/**
 * Get customer subscriptions
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Subscriptions with pagination
 */
export async function getCustomerSubscriptionsService(organizationId, customerId, query) {
  const { limit, cursor } = query;
  return await getCustomerSubscriptions(organizationId, customerId, { limit, cursor });
}

/**
 * Get customer invoices
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Invoices with pagination
 */
export async function getCustomerInvoicesService(organizationId, customerId, query) {
  const { limit, cursor, status } = query;
  return await getCustomerInvoices(organizationId, customerId, { limit, cursor }, { status });
}

/**
 * Get customer payments
 * @param {string} organizationId - Organization ID
 * @param {string} customerId - Customer ID
 * @param {Object} query - Query parameters
 * @returns {Promise<Object>} Payments with pagination
 */
export async function getCustomerPaymentsService(organizationId, customerId, query) {
  const { limit, cursor } = query;
  return await getCustomerPayments(organizationId, customerId, { limit, cursor });
}

export default {
  getCustomer,
  listCustomersService,
  createCustomerService,
  updateCustomerService,
  deleteCustomerService,
  getCustomerBillingInfoService,
  updateCustomerBillingInfoService,
  getCustomerSubscriptionsService,
  getCustomerInvoicesService,
  getCustomerPaymentsService,
};