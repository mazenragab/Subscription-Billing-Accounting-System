import Joi from 'joi';

export const createWebhookSchema = Joi.object({
  url: Joi.string().uri().required(),
  events: Joi.array().items(Joi.string()).min(1).required(),
  secret: Joi.string().min(32).optional(),
});

export const updateWebhookSchema = Joi.object({
  url: Joi.string().uri().optional(),
  events: Joi.array().items(Joi.string()).min(1).optional(),
  is_active: Joi.boolean().optional(),
});

export const listWebhookEventsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  cursor: Joi.string().optional(),
});

export default {
  createWebhookSchema,
  updateWebhookSchema,
  listWebhookEventsSchema,
};