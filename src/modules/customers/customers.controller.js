import {
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
} from './customers.service.js';

/**
 * Customers Controller
 * Handles HTTP request/response for customer management
 */

/**
 * List customers
 */
export async function listCustomers(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await listCustomersService(organizationId, query);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get customer by ID
 */
export async function getCustomerById(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    
    const result = await getCustomer(organizationId, id);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create customer
 */
export async function createCustomer(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await createCustomerService(organizationId, data, userId);
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update customer
 */
export async function updateCustomer(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await updateCustomerService(organizationId, id, data, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete customer (soft delete)
 */
export async function deleteCustomer(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    
    await deleteCustomerService(organizationId, id, userId);
    
    res.status(200).json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get customer billing info
 */
export async function getBillingInfo(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    
    const result = await getCustomerBillingInfoService(organizationId, id);
    
    res.status(200).json({
      success: true,
      data: result || {},
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update customer billing info
 */
export async function updateBillingInfo(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await updateCustomerBillingInfoService(organizationId, id, data, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get customer subscriptions
 */
export async function getSubscriptions(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const query = req.query;
    
    const result = await getCustomerSubscriptionsService(organizationId, id, query);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get customer invoices
 */
export async function getInvoices(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const query = req.query;
    
    const result = await getCustomerInvoicesService(organizationId, id, query);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get customer payments
 */
export async function getPayments(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const query = req.query;
    
    const result = await getCustomerPaymentsService(organizationId, id, query);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getBillingInfo,
  updateBillingInfo,
  getSubscriptions,
  getInvoices,
  getPayments,
};