/**
 * Wraps an async Express route handler to forward errors to next().
 * Without this, unhandled promise rejections in async routes are swallowed.
 *
 * @param {Function} fn - async (req, res, next) => {}
 * @returns {Function} Express middleware
 *
 * @example
 *   router.get('/invoices', asyncHandler(async (req, res) => {
 *     const data = await invoicesService.findAll(req.tenantId);
 *     res.json(data);
 *   }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;