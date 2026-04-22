/**
 * Factory function that creates Express middleware for Joi validation.
 * Validates request body, query, and/or params against provided schemas.
 *
 * @param {Object} schemas - Joi validation schemas
 * @param {Object} schemas.body - Schema for req.body
 * @param {Object} schemas.query - Schema for req.query
 * @param {Object} schemas.params - Schema for req.params
 * @returns {Function} Express middleware
 *
 * @example
 * const validate = validateMiddleware({
 *   body: Joi.object({
 *     name: Joi.string().required(),
 *     email: Joi.string().email().required()
 *   })
 * });
 * router.post('/customers', validate, createCustomer);
 */
const validateMiddleware = (schemas) => {
  return (req, res, next) => {
    const errors = [];

    // Validate request body
    if (schemas.body) {
      const { error, value } = schemas.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          location: 'body'
        })));
      } else {
        req.body = value; // Replace with validated value
      }
    }

    // Validate query parameters
    if (schemas.query) {
      const { error, value } = schemas.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          location: 'query'
        })));
      } else {
        req.query = value;
      }
    }

    // Validate route parameters
    if (schemas.params) {
      const { error, value } = schemas.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          location: 'params'
        })));
      } else {
        req.params = value;
      }
    }

    if (errors.length > 0) {
      const validationError = new Error('Validation failed');
      validationError.statusCode = 422;
      validationError.code = 'VALIDATION_ERROR';
      validationError.details = errors;
      return next(validationError);
    }

    next();
  };
};

export default validateMiddleware;