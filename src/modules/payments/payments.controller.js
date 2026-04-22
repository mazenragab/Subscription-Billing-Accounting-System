import {
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
} from './payments.service.js';

/**
 * Payments Controller
 * Handles HTTP request/response for payment management
 */

/**
 * Process payment for invoice
 */
export async function processPaymentController(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { invoiceId } = req.params;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await processPayment(organizationId, invoiceId, data, userId);
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get payment by ID
 */
export async function getPayment(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { paymentId } = req.params;
    
    const result = await getPaymentDetails(organizationId, paymentId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List payments
 */
export async function listPayments(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await listPaymentsService(organizationId, query);
    
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
 * Get customer payment summary
 */
export async function getCustomerPaymentSummary(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { customerId } = req.params;
    
    const result = await getCustomerPaymentSummaryService(organizationId, customerId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get payment statistics
 */
export async function getPaymentStats(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await getPaymentStatistics(organizationId, query);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Save payment method for customer
 */
export async function savePaymentMethod(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { customerId } = req.params;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await savePaymentMethodService(organizationId, customerId, data, userId);
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get customer payment methods
 */
export async function getCustomerPaymentMethods(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { customerId } = req.params;
    
    const result = await getCustomerPaymentMethodsService(organizationId, customerId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete payment method
 */
export async function deletePaymentMethod(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { customerId, paymentMethodId } = req.params;
    const userId = req.user.userId;
    
    await deletePaymentMethodService(organizationId, customerId, paymentMethodId, userId);
    
    res.status(200).json({
      success: true,
      message: 'Payment method deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get payment attempts for invoice
 */
export async function getPaymentAttempts(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { invoiceId } = req.params;
    
    const result = await getPaymentAttemptsService(organizationId, invoiceId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Simulate payment webhook (for testing)
 */
export async function paymentWebhook(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const data = req.body;
    
    const result = await simulatePaymentWebhook(organizationId, data);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  processPaymentController,
  getPayment,
  listPayments,
  getCustomerPaymentSummary,
  getPaymentStats,
  savePaymentMethod,
  getCustomerPaymentMethods,
  deletePaymentMethod,
  getPaymentAttempts,
  paymentWebhook,
};