import {
  createWebhookEndpoint as createWebhookEndpointService,
  getWebhookEndpoints as getWebhookEndpointsService,
  getWebhookEndpointById as getWebhookEndpointByIdService,
  updateWebhookEndpoint as updateWebhookEndpointService,
  deleteWebhookEndpoint as deleteWebhookEndpointService,
  regenerateWebhookSecret as regenerateWebhookSecretService,
  getWebhookEvents as getWebhookEventsService,
  resendWebhookEvent as resendWebhookEventService,
  sendTestWebhook as sendTestWebhookService,
} from './webhooks.service.js';

/**
 * Create webhook endpoint
 */
export async function createWebhookEndpoint(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await createWebhookEndpointService(organizationId, data, userId);
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all webhook endpoints
 */
export async function getWebhookEndpoints(req, res, next) {
  try {
    const organizationId = req.tenantId;
    
    const result = await getWebhookEndpointsService(organizationId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get webhook endpoint by ID
 */
export async function getWebhookEndpointById(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    
    const result = await getWebhookEndpointByIdService(organizationId, id);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update webhook endpoint
 */
export async function updateWebhookEndpoint(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    const data = req.body;
    
    const result = await updateWebhookEndpointService(organizationId, id, data, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete webhook endpoint
 */
export async function deleteWebhookEndpoint(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    
    await deleteWebhookEndpointService(organizationId, id, userId);
    
    res.status(200).json({
      success: true,
      message: 'Webhook endpoint deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Regenerate webhook secret
 */
export async function regenerateWebhookSecret(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    
    const result = await regenerateWebhookSecretService(organizationId, id, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get webhook events
 */
export async function getWebhookEvents(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const query = req.query;
    
    const result = await getWebhookEventsService(organizationId, id, query);
    
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
 * Resend webhook event
 */
export async function resendWebhookEvent(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { eventId } = req.params;
    const userId = req.user.userId;
    
    const result = await resendWebhookEventService(organizationId, eventId, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Send test webhook
 */
export async function sendTestWebhook(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.userId;
    
    const result = await sendTestWebhookService(organizationId, id, userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  createWebhookEndpoint,
  getWebhookEndpoints,
  getWebhookEndpointById,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  regenerateWebhookSecret,
  getWebhookEvents,
  resendWebhookEvent,
  sendTestWebhook,
};