import express from 'express';
import {
  createWebhookEndpoint,
  getWebhookEndpoints,
  getWebhookEndpointById,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  regenerateWebhookSecret,
  getWebhookEvents,
  resendWebhookEvent,
  sendTestWebhook,
} from '../../webhooks/webhook.service.js';
import authMiddleware from '../../middleware/auth.middleware.js';
import tenantMiddleware from '../../middleware/tenant.middleware.js';
import validateMiddleware from '../../middleware/validate.middleware.js';
import Joi from 'joi';

const router = express.Router();

// All webhook routes require auth and tenant context
router.use(authMiddleware, tenantMiddleware);

// Validation schemas
const createWebhookSchema = Joi.object({
  url: Joi.string().uri().required(),
  events: Joi.array().items(Joi.string()).min(1).required(),
  secret: Joi.string().min(32).optional(),
});

const updateWebhookSchema = Joi.object({
  url: Joi.string().uri().optional(),
  events: Joi.array().items(Joi.string()).min(1).optional(),
  is_active: Joi.boolean().optional(),
});

/**
 * @route GET /api/v1/webhooks
 * @desc Get all webhook endpoints
 * @access Private
 */
router.get('/', async (req, res, next) => {
  try {
    const endpoints = await getWebhookEndpoints(req.tenantId);
    res.json({ success: true, data: endpoints });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v1/webhooks
 * @desc Create webhook endpoint
 * @access Private
 */
router.post(
  '/',
  validateMiddleware({ body: createWebhookSchema }),
  async (req, res, next) => {
    try {
      const endpoint = await createWebhookEndpoint(req.tenantId, req.body);
      res.status(201).json({ success: true, data: endpoint });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/webhooks/:id
 * @desc Get webhook endpoint by ID
 * @access Private
 */
router.get('/:id', async (req, res, next) => {
  try {
    const endpoint = await getWebhookEndpointById(req.tenantId, req.params.id);
    res.json({ success: true, data: endpoint });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PATCH /api/v1/webhooks/:id
 * @desc Update webhook endpoint
 * @access Private
 */
router.patch(
  '/:id',
  validateMiddleware({ body: updateWebhookSchema }),
  async (req, res, next) => {
    try {
      const endpoint = await updateWebhookEndpoint(req.tenantId, req.params.id, req.body);
      res.json({ success: true, data: endpoint });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route DELETE /api/v1/webhooks/:id
 * @desc Delete webhook endpoint
 * @access Private
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteWebhookEndpoint(req.tenantId, req.params.id);
    res.json({ success: true, message: 'Webhook endpoint deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v1/webhooks/:id/regenerate-secret
 * @desc Regenerate webhook secret
 * @access Private
 */
router.post('/:id/regenerate-secret', async (req, res, next) => {
  try {
    const result = await regenerateWebhookSecret(req.tenantId, req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v1/webhooks/:id/events
 * @desc Get webhook events for endpoint
 * @access Private
 */
router.get('/:id/events', async (req, res, next) => {
  try {
    const { limit, cursor } = req.query;
    const result = await getWebhookEvents(req.tenantId, req.params.id, {
      limit: limit ? parseInt(limit) : 20,
      cursor: cursor || null,
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v1/webhooks/:id/test
 * @desc Send test webhook
 * @access Private
 */
router.post('/:id/test', async (req, res, next) => {
  try {
    const result = await sendTestWebhook(req.tenantId, req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v1/webhooks/events/:eventId/resend
 * @desc Resend failed webhook event
 * @access Private
 */
router.post('/events/:eventId/resend', async (req, res, next) => {
  try {
    const result = await resendWebhookEvent(req.tenantId, req.params.eventId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;