import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import logger from '../../shared/utils/logger.js';
import { webhookQueue } from '../../webhooks/webhook.job.js';
import { emitEvent, WEBHOOK_EVENTS } from '../../webhooks/webhook.service.js';
import { ValidationError, NotFoundError } from '../../shared/errors/index.js';

const ALL_EVENTS = Object.values(WEBHOOK_EVENTS);

/**
 * Generate webhook secret
 */
function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create webhook endpoint
 */
export async function createWebhookEndpoint(organizationId, data, userId) {
  const { url, events, secret } = data;
  
  // Validate events
  const invalidEvents = events.filter(e => !ALL_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    throw new ValidationError(`Invalid events: ${invalidEvents.join(', ')}`);
  }
  
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
    userId,
  });
  
  return endpoint;
}

/**
 * Get webhook endpoints
 */
export async function getWebhookEndpoints(organizationId) {
  return await prisma.webhookEndpoint.findMany({
    where: { organization_id: organizationId },
    orderBy: { created_at: 'desc' },
  });
}

/**
 * Get webhook endpoint by ID
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
 */
export async function updateWebhookEndpoint(organizationId, endpointId, data, userId) {
  await getWebhookEndpointById(organizationId, endpointId);
  
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
      is_active: data.is_active !== undefined ? data.is_active : undefined,
    },
  });
  
  logger.info('Webhook endpoint updated', { organizationId, endpointId, userId });
  
  return updated;
}

/**
 * Delete webhook endpoint
 */
export async function deleteWebhookEndpoint(organizationId, endpointId, userId) {
  await getWebhookEndpointById(organizationId, endpointId);
  
  await prisma.webhookEndpoint.delete({ where: { id: endpointId } });
  
  logger.info('Webhook endpoint deleted', { organizationId, endpointId, userId });
  
  return true;
}

/**
 * Regenerate webhook secret
 */
export async function regenerateWebhookSecret(organizationId, endpointId, userId) {
  await getWebhookEndpointById(organizationId, endpointId);
  
  const newSecret = generateWebhookSecret();
  
  await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: { secret: newSecret },
  });
  
  logger.info('Webhook secret regenerated', { organizationId, endpointId, userId });
  
  return { secret: newSecret };
}

/**
 * Get webhook events
 */
export async function getWebhookEvents(organizationId, endpointId, query) {
  await getWebhookEndpointById(organizationId, endpointId);
  
  const { limit = 20, cursor = null } = query;
  
  const where = { endpoint_id: endpointId };
  if (cursor) where.id = { gt: cursor };
  
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
    pagination: { limit, hasNextPage, nextCursor, count: data.length },
  };
}

/**
 * Resend webhook event
 */
export async function resendWebhookEvent(organizationId, eventId, userId) {
  const webhookEvent = await prisma.webhookEvent.findFirst({
    where: { id: eventId, organization_id: organizationId },
    include: { endpoint: true },
  });
  
  if (!webhookEvent) {
    throw new NotFoundError('Webhook event');
  }
  
  if (webhookEvent.status === 'DELIVERED') {
    throw new ValidationError('Cannot resend a delivered webhook event');
  }
  
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { status: 'PENDING', attempts: 0, last_attempted_at: null, delivered_at: null },
  });
  
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
    { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
  );
  
  logger.info('Webhook event rescheduled', { organizationId, eventId, userId });
  
  return webhookEvent;
}

/**
 * Send test webhook
 */
export async function sendTestWebhook(organizationId, endpointId, userId) {
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
    { attempts: 1, delay: 0 }
  );
  
  logger.info('Test webhook sent', { organizationId, endpointId, userId });
  
  return { event_id: webhookEvent.id, message: 'Test webhook sent' };
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