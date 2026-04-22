import logger from '../shared/utils/logger.js';
import config from '../config/env.js';

/**
 * Central error handling middleware.
 * Maps all errors to consistent HTTP responses.
 * 
 * Error types handled:
 * - AppError subclasses -> mapped to their status codes
 * - Validation errors (Joi) -> 422
 * - Prisma errors -> appropriate HTTP responses
 * - Unknown errors -> 500 (with no stack trace in production)
 */
const errorHandlerMiddleware = (err, req, res, next) => {
  // Default error values
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || [];

  // Log error with request context
  const logContext = {
    requestId: req.requestId,
    userId: req.user?.id,
    tenantId: req.tenantId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    statusCode,
    code,
  };

  // Handle Prisma errors
  if (err.code && err.code.startsWith('P2')) {
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        statusCode = 409;
        code = 'DUPLICATE_RESOURCE';
        message = 'A resource with this identifier already exists';
        details = [{ field: err.meta?.target, message: 'Must be unique' }];
        break;
      case 'P2025': // Record not found
        statusCode = 404;
        code = 'NOT_FOUND';
        message = 'The requested resource was not found';
        break;
      case 'P2003': // Foreign key violation
        statusCode = 400;
        code = 'INVALID_REFERENCE';
        message = 'Referenced resource does not exist';
        break;
      default:
        statusCode = 400;
        code = 'DATABASE_ERROR';
        message = 'Database operation failed';
    }
    logger.warn('Prisma error', { ...logContext, prismaCode: err.code, error: err.message });
  }
  // Handle Joi validation errors (already handled by validate middleware, but catch any)
  else if (err.name === 'ValidationError' && err.isJoi) {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    logger.warn('Validation error', logContext);
  }
  // Handle our custom AppErrors
  else if (err.isOperational) {
    logger.warn('Operational error', { ...logContext, error: message });
  }
  // Unknown errors (bugs)
  else {
    logger.error('Unhandled error', { ...logContext, stack: err.stack, error: err.message });
    
    // Don't expose internal error details in production
    if (config.app.isProduction) {
      message = 'An internal server error occurred';
      code = 'INTERNAL_SERVER_ERROR';
      details = [];
    } else {
      // In development, include stack trace and original error
      message = err.message;
      details = [{ stack: err.stack }];
    }
  }

  // Send response
  res.status(statusCode).json({
    error: message,
    code,
    details: details.length > 0 ? details : undefined,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
};

export default errorHandlerMiddleware;