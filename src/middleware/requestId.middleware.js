import { v4 as uuidv4 } from 'uuid';

/**
 * Injects a unique X-Request-ID into every request and response.
 * Uses the incoming header if provided (for distributed tracing), or generates a new one.
 * This ID is attached to all log entries for the duration of the request.
 */
const requestIdMiddleware = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

export default requestIdMiddleware;