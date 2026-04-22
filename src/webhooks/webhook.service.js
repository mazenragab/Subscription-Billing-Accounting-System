import crypto from 'crypto';
import { prisma } from '../config/database.js';
import logger from '../shared/utils/logger.js';
import { webhookQueue } from './webhook.job.js';
import { ValidationError, NotFoundError } from '../shared/errors/index.js';

/**
 * Webhook Service
 * Handles event emission, webhook endpoint management, and delivery scheduling
 */

// Event types that can be subscribed to
export const WEBHOOK_EVENTS = {
  // Tenant events
  TENANT_CREATED: 'tenant.created',
  
  // Customer events
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_DELETED: 'customer.deleted',
  
  // Subscription events
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_ACTIVATED: 'subscription.activated',
  SUBSCRIPTION_TRIAL_STARTED: 'subscription.trial_started',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_UPGRADED: 'subscription.upgraded',
  SUBSCRIPTION_DOWNGRADED: 'subscription.downgraded',
  SUBSCRIPTION_PAUSED: 'subscription.paused',
  SUBSCRIPTION_RESUMED: 'subscription.resumed',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  SUBSCRIPTION_EXPIRED: 'subscription.expired',
  
  // Invoice events
  INVOICE_CREATED: 'invoice.created',
  INVOICE_ISSUED: 'invoice.issued',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_VOIDED: 'invoice.voided',
  INVOICE_UNCOLLECTIBLE: 'invoice.uncollectible',
  INVOICE_PAYMENT_DUE: 'invoice.payment_due',
  
  // Payment events
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  
  // Recognition events
  RECOGNITION_COMPLETED: 'recognition.completed',
};

// All available event types for webhook subscription
export const ALL_EVENTS = Object.values(WEBHOOK_EVENTS);

/**
 * Create a webhook endpoint for an organization
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Webhook endpoint data
 * @returns {Promise<Object>} Created webhook endpoint
 */
export async function createWebhookEndpoint(organizationId, data) {
  const { url, events, secret } = data;
  
  // Validate events
  const invalidEvents = events.filter(e => !ALL_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    throw new ValidationError(`Invalid events: ${invalidEvents.join(', ')}`);
  }
  
  // Generate secret if not provided
  const webhookSecret = secret || generateWebhookSecret();
  
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      organization_id: organizationId,
      url,
      secret: webhookSecret,
      events,
      is_active: true,
    },
  });
  
  logger.info('Webhook endpoint created', {
    organizationId,
    endpointId: endpoint.id,
    url,
    eventCount: events.length,
  });
  
  return endpoint;
}

/**
 * Get webhook endpoints for an organization
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array>} Webhook endpoints
 */
export async function getWebhookEndpoints(organizationId) {
  return await prisma.webhookEndpoint.findMany({
    where: {
      organization_id: organizationId,
    },
    orderBy: { created_at: 'desc' },
  });
}

/**
 * Get webhook endpoint by ID
 * @param {string} organizationId - Organization ID
 * @param {string} endpointId - Endpoint ID
 * @returns {Promise<Object>} Webhook endpoint
 */
export async function getWebhookEndpointById(organizationId, endpointId) {
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: {
      id: endpointId,
      organization_id: organizationId,
    },
  });
  
  if (!endpoint) {
    throw new NotFoundError('Webhook endpoint');
  }
  
  return endpoint;
}

/**
 * Update webhook endpoint
 * @param {string} organizationId - Organization ID
 * @param {string} endpointId - Endpoint ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated endpoint
 */
export async function updateWebhookEndpoint(organizationId, endpointId, data) {
  const endpoint = await getWebhookEndpointById(organizationId, endpointId);
  
  // Validate events if provided
  if (data.events) {
    const invalidEvents = data.events.filter(e => !ALL_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      throw new ValidationError(`Invalid events: ${invalidEvents.join(', ')}`);
    }
  }
  
  const updated = await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: {
      url: data.url,
      events: data.events,
      is_active: data.is_active !== undefined ? data.is_active : endpoint.is_active,
      updated_at: new Date(),
    },
  });
  
  logger.info('Webhook endpoint updated', {
    organizationId,
    endpointId,
  });
  
  return updated;
}

/**
 * Delete webhook endpoint
 * @param {string} organizationId - Organization ID
 * @param {string} endpointId - Endpoint ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteWebhookEndpoint(organizationId, endpointId) {
  await getWebhookEndpointById(organizationId, endpointId);
  
  await prisma.webhookEndpoint.delete({
    where: { id: endpointId },
  });
  
  logger.info('Webhook endpoint deleted', {
    organizationId,
    endpointId,
  });
  
  return true;
}

/**
 * Regenerate webhook secret
 * @param {string} organizationId - Organization ID
 * @param {string} endpointId - Endpoint ID
 * @returns {Promise<Object>} New secret
 */
export async function regenerateWebhookSecret(organizationId, endpointId) {
  await getWebhookEndpointById(organizationId, endpointId);
  
  const newSecret = generateWebhookSecret();
  
  await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: { secret: newSecret },
  });
  
  logger.info('Webhook secret regenerated', {
    organizationId,
    endpointId,
  });
  
  return { secret: newSecret };
}

/**
 * Generate a webhook secret
 * @returns {string} Webhook secret
 */
function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Emit an event to all subscribed webhook endpoints
 * @param {string} organizationId - Organization ID
 * @param {string} eventType - Event type (e.g., 'invoice.paid')
 * @param {Object} payload - Event payload
 * @returns {Promise<Array>} Created webhook events
 */
export async function emitEvent(organizationId, eventType, payload) {
  // Find all active endpoints subscribed to this event
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      organization_id: organizationId,
      is_active: true,
      events: { has: eventType },
    },
  });
  
  if (endpoints.length === 0) {
    logger.debug('No webhook endpoints subscribed to event', {
      organizationId,
      eventType,
    });
    return [];
  }
  
  // Create webhook events for each endpoint
  const webhookEvents = [];
  
  for (const endpoint of endpoints) {
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        organization_id: organizationId,
        endpoint_id: endpoint.id,
        event_type: eventType,
        payload,
        status: 'PENDING',
        attempts: 0,
      },
    });
    
    webhookEvents.push(webhookEvent);
    
    // Queue the webhook delivery
    await webhookQueue.add(
      `webhook-${webhookEvent.id}`,
      {
        webhookEventId: webhookEvent.id,
        endpointId: endpoint.id,
        organizationId,
        url: endpoint.url,
        secret: endpoint.secret,
        eventType,
        payload,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    );
  }
  
  logger.info('Event emitted', {
    organizationId,
    eventType,
    endpointCount: endpoints.length,
  });
  
  return webhookEvents;
}

/**
 * Get webhook events for an endpoint
 * @param {string} organizationId - Organization ID
 * @param {string} endpointId - Endpoint ID
 * @param {Object} pagination - Pagination params
 * @returns {Promise<Object>} Webhook events with pagination
 */
export async function getWebhookEvents(organizationId, endpointId, { limit = 20, cursor = null }) {
  await getWebhookEndpointById(organizationId, endpointId);
  
  const where = {
    endpoint_id: endpointId,
  };
  
  if (cursor) {
    where.id = { gt: cursor };
  }
  
  const events = await prisma.webhookEvent.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit + 1,
  });
  
  const hasNextPage = events.length > limit;
  const data = hasNextPage ? events.slice(0, limit) : events;
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
 * Resend a failed webhook event
 * @param {string} organizationId - Organization ID
 * @param {string} eventId - Webhook event ID
 * @returns {Promise<Object>} Rescheduled event
 */
export async function resendWebhookEvent(organizationId, eventId) {
  const webhookEvent = await prisma.webhookEvent.findFirst({
    where: {
      id: eventId,
      organization_id: organizationId,
    },
    include: {
      endpoint: true,
    },
  });
  
  if (!webhookEvent) {
    throw new NotFoundError('Webhook event');
  }
  
  if (webhookEvent.status === 'DELIVERED') {
    throw new ValidationError('Cannot resend a delivered webhook event');
  }
  
  // Reset the event
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: {
      status: 'PENDING',
      attempts: 0,
      last_attempted_at: null,
      delivered_at: null,
    },
  });
  
  // Queue for delivery
  await webhookQueue.add(
    `webhook-${webhookEvent.id}`,
    {
      webhookEventId: webhookEvent.id,
      endpointId: webhookEvent.endpoint_id,
      organizationId,
      url: webhookEvent.endpoint.url,
      secret: webhookEvent.endpoint.secret,
      eventType: webhookEvent.event_type,
      payload: webhookEvent.payload,
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    }
  );
  
  logger.info('Webhook event rescheduled', {
    organizationId,
    eventId,
  });
  
  return webhookEvent;
}

/**
 * Send a test webhook event to an endpoint
 * @param {string} organizationId - Organization ID
 * @param {string} endpointId - Endpoint ID
 * @returns {Promise<Object>} Test event result
 */
export async function sendTestWebhook(organizationId, endpointId) {
  const endpoint = await getWebhookEndpointById(organizationId, endpointId);
  
  const testPayload = {
    test: true,
    message: 'This is a test webhook from your billing system',
    timestamp: new Date().toISOString(),
    endpoint_id: endpointId,
  };
  
  const webhookEvent = await prisma.webhookEvent.create({
    data: {
      organization_id: organizationId,
      endpoint_id: endpointId,
      event_type: 'test.webhook',
      payload: testPayload,
      status: 'PENDING',
      attempts: 0,
    },
  });
  
  // Queue for immediate delivery
  await webhookQueue.add(
    `webhook-test-${webhookEvent.id}`,
    {
      webhookEventId: webhookEvent.id,
      endpointId: endpoint.id,
      organizationId,
      url: endpoint.url,
      secret: endpoint.secret,
      eventType: 'test.webhook',
      payload: testPayload,
    },
    {
      attempts: 1,
      delay: 0,
    }
  );
  
  logger.info('Test webhook sent', {
    organizationId,
    endpointId,
    eventId: webhookEvent.id,
  });
  
  return {
    event_id: webhookEvent.id,
    message: 'Test webhook sent',
  };
}

/**
 * Generate webhook signature for payload verification
 * @param {string} secret - Webhook secret
 * @param {Object} payload - Payload to sign
 * @returns {string} HMAC-SHA256 signature
 */
export function generateWebhookSignature(secret, payload) {
  const payloadString = JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');
}

/**
 * Verify webhook signature
 * @param {string} secret - Webhook secret
 * @param {Object} payload - Payload to verify
 * @param {string} signature - Signature to verify against
 * @returns {boolean} Whether signature is valid
 */
export function verifyWebhookSignature(secret, payload, signature) {
  const expectedSignature = generateWebhookSignature(secret, payload);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export default {
  WEBHOOK_EVENTS,
  ALL_EVENTS,
  createWebhookEndpoint,
  getWebhookEndpoints,
  getWebhookEndpointById,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  regenerateWebhookSecret,
  emitEvent,
  getWebhookEvents,
  resendWebhookEvent,
  sendTestWebhook,
  generateWebhookSignature,
  verifyWebhookSignature,
};