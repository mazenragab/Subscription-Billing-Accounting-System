/**
 * Base application error.
 * All custom errors extend this class.
 * The error handler middleware maps these to HTTP responses.
 */
class AppError extends Error {
  /**
   * @param {string} message - human-readable message
   * @param {number} statusCode - HTTP status code
   * @param {string} code - machine-readable error code
   * @param {Array} [details] - optional validation details
   */
  constructor(message, statusCode, code, details = []) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // signals this is an expected error, not a bug
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;