import {
  createDraftInvoice as createDraftInvoiceService,
  issueInvoice as issueInvoiceService,
  voidInvoice as voidInvoiceService,
  markInvoiceUncollectible as markInvoiceUncollectibleService,
  recordPayment as recordPaymentService,
  getInvoiceDetails,
  listInvoicesService,
  getInvoiceJournalEntries,
  getInvoicePaymentsService,
  getOrganizationPaymentsService,
  getPaymentDetails,
} from './invoices.service.js';

/**
 * Invoices Controller
 * Handles HTTP request/response for invoice management
 */

/**
 * List invoices
 */
export async function listInvoices(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await listInvoicesService(organizationId, query);
    
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
 * Create draft invoice
 */
export async function createDraftInvoice(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await createDraftInvoiceService(organizationId, data, userId);
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get invoice by ID
 */
export async function getInvoice(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    
    const result = await getInvoiceDetails(organizationId, id);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Issue invoice (DRAFT → ISSUED)
 */
export async function issueInvoice(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await issueInvoiceService(organizationId, id, data, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Void invoice
 */
export async function voidInvoice(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    
    const result = await voidInvoiceService(organizationId, id, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark invoice as uncollectible
 */
export async function markUncollectible(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    
    const result = await markInvoiceUncollectibleService(organizationId, id, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Record payment for invoice
 */
export async function recordPayment(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await recordPaymentService(organizationId, id, data, userId);
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get invoice payments
 */
export async function getInvoicePayments(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    
    const result = await getInvoicePaymentsService(organizationId, id);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get invoice journal entries
 */
export async function getJournalEntries(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    
    const result = await getInvoiceJournalEntries(organizationId, id);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get organization-wide payments
 */
export async function getOrganizationPayments(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await getOrganizationPaymentsService(organizationId, query);
    
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

export default {
  listInvoices,
  createDraftInvoice,
  getInvoice,
  issueInvoice,
  voidInvoice,
  markUncollectible,
  recordPayment,
  getInvoicePayments,
  getJournalEntries,
  getOrganizationPayments,
  getPayment,
};