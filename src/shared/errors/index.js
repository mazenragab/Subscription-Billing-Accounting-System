import AppError from './AppError.js';

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Thrown when a double-entry journal entry fails validation.
 * Specifically: when Σ DEBIT ≠ Σ CREDIT, or when account codes are invalid.
 */
export class AccountingError extends AppError {
  constructor(message, details = []) {
    super(message, 422, 'ACCOUNTING_ERROR', details);
    this.isAccountingError = true;
  }
}

/**
 * Thrown when an invalid subscription state transition is attempted.
 * e.g., trying to resume a CANCELLED subscription.
 */
export class InvalidTransitionError extends AppError {
  constructor(fromStatus, toStatus) {
    super(
      `Invalid subscription transition: ${fromStatus} → ${toStatus}`,
      422,
      'INVALID_TRANSITION'
    );
  }
}

// Also provide a default export with all errors
export default {
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  AccountingError,
  InvalidTransitionError,
};