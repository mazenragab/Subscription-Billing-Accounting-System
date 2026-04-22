import config from '../../config/env.js';

/**
 * Cursor-based pagination utilities.
 *
 * Why cursor-based instead of offset?
 * - Offset pagination breaks on live data: rows inserted during pagination
 *   cause items to be skipped or duplicated.
 * - Cursor pagination is stable: uses the last record's ID as the anchor.
 * - Better performance at scale: no OFFSET scan, always uses index.
 *
 * Usage:
 *   GET /invoices?limit=20&cursor=<base64-encoded-id>
 */

/**
 * Parse pagination params from query string.
 * @param {Object} query - req.query
 * @returns {{ limit: number, cursor: string|null }}
 */
export function parsePagination(query) {
  const limit = Math.min(
    parseInt(query.limit, 10) || config.pagination.defaultPageSize,
    config.pagination.maxPageSize
  );
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  return { limit, cursor };
}

/**
 * Build the Prisma pagination args.
 * @param {string|null} cursor - decoded cursor (UUID)
 * @param {number} limit
 * @returns {Object} Prisma take/skip/cursor args
 */
export function buildPrismaArgs(cursor, limit) {
  const args = { take: limit + 1 }; // fetch +1 to know if there's a next page
  if (cursor) {
    args.cursor = { id: cursor };
    args.skip = 1; // skip the cursor record itself
  }
  return args;
}

/**
 * Build the pagination response metadata.
 * @param {Array} items - raw result from Prisma (may have limit+1 items)
 * @param {number} limit
 * @returns {{ data: Array, pagination: Object }}
 */
export function buildPaginationResponse(items, limit) {
  const hasNextPage = items.length > limit;
  const data = hasNextPage ? items.slice(0, limit) : items;
  const nextCursor =
    hasNextPage && data.length > 0
      ? encodeCursor(data[data.length - 1].id)
      : null;

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
 * Encode a UUID to a URL-safe base64 cursor.
 * @param {string} id
 * @returns {string}
 */
export function encodeCursor(id) {
  return Buffer.from(id).toString('base64url');
}

/**
 * Decode a base64 cursor back to a UUID.
 * @param {string} cursor
 * @returns {string}
 */
export function decodeCursor(cursor) {
  try {
    return Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

// At the end of the file, you can also add:
export default {
  parsePagination,
  buildPrismaArgs,
  buildPaginationResponse,
  encodeCursor,
  decodeCursor
};