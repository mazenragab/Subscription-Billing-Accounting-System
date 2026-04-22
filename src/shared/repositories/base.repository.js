import { NotFoundError } from '../errors/index.js';
import { prisma } from '../../config/database.js';

/**
 * Base repository — provides tenant-safe CRUD operations.
 *
 * TENANT SAFETY GUARANTEE:
 * Every method calls _requireTenantId() before any query.
 * If tenantId is missing, an error is thrown immediately.
 * This prevents accidental cross-tenant data access.
 *
 * All subclasses inherit these methods and can override them.
 * Subclasses should call super() with the Prisma model delegate.
 *
 * @example
 *   class InvoicesRepository extends BaseRepository {
 *     constructor() { super('invoice'); }  // prisma.invoice
 *
 *     async findByStatus(tenantId, status) {
 *       this._requireTenantId(tenantId);
 *       return this.model.findMany({
 *         where: { organization_id: tenantId, status }
 *       });
 *     }
 *   }
 */
class BaseRepository {
  /**
   * @param {string} modelName - Prisma model name (camelCase), e.g. 'invoice'
   */
  constructor(modelName) {
    this.modelName = modelName;
    // Prisma client is lazy-loaded to avoid circular dependency issues
    // and to allow easy mocking in tests.
    this._prismaModelName = modelName;
    this._model = null;
  }

  /**
   * Lazy-load the Prisma model delegate.
   * @returns {Object} Prisma model
   */
  get model() {
    if (!this._model) {
      this._model = prisma[this._prismaModelName];
    }
    return this._model;
  }

  /**
   * CRITICAL: Called at the top of every public method.
   * Throws immediately if tenantId is missing or invalid.
   * @param {string} tenantId
   * @throws {Error}
   */
  _requireTenantId(tenantId) {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      const err = new Error(
        `[${this.modelName}Repository] Called without tenantId — potential cross-tenant data leak. Stack: ${new Error().stack}`
      );
      err.code = 'TENANT_ID_REQUIRED';
      throw err;
    }
  }

  /**
   * Find a single record by ID, scoped to tenant.
   * @param {string} tenantId
   * @param {string} id
   * @param {Object} [options] - Prisma include/select
   * @returns {Promise<Object>}
   * @throws {NotFoundError}
   */
  async findById(tenantId, id, options = {}) {
    this._requireTenantId(tenantId);
    const record = await this.model.findFirst({
      where: { id, organization_id: tenantId },
      ...options,
    });
    if (!record) throw new NotFoundError(this.modelName);
    return record;
  }

  /**
   * Find multiple records, scoped to tenant.
   * @param {string} tenantId
   * @param {Object} [where={}] - additional where conditions
   * @param {Object} [options={}] - Prisma orderBy, include, take, cursor, skip
   * @returns {Promise<Array>}
   */
  async findMany(tenantId, where = {}, options = {}) {
    this._requireTenantId(tenantId);
    return this.model.findMany({
      where: { organization_id: tenantId, ...where },
      ...options,
    });
  }

  /**
   * Count records scoped to tenant.
   * @param {string} tenantId
   * @param {Object} [where={}]
   * @returns {Promise<number>}
   */
  async count(tenantId, where = {}) {
    this._requireTenantId(tenantId);
    return this.model.count({
      where: { organization_id: tenantId, ...where },
    });
  }

  /**
   * Create a record — always injects organization_id.
   * @param {string} tenantId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(tenantId, data) {
    this._requireTenantId(tenantId);
    return this.model.create({
      data: { ...data, organization_id: tenantId },
    });
  }

  /**
   * Update a record, verifying tenant ownership.
   * @param {string} tenantId
   * @param {string} id
   * @param {Object} data
   * @returns {Promise<Object>}
   * @throws {NotFoundError}
   */
  async update(tenantId, id, data) {
    this._requireTenantId(tenantId);
    // Verify ownership before update
    await this.findById(tenantId, id);
    return this.model.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft-delete a record by setting deleted_at.
   * Only works on models that have a deleted_at field.
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async softDelete(tenantId, id) {
    this._requireTenantId(tenantId);
    await this.findById(tenantId, id);
    return this.model.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  /**
   * Check if a record exists for this tenant.
   * @param {string} tenantId
   * @param {Object} where
   * @returns {Promise<boolean>}
   */
  async exists(tenantId, where) {
    this._requireTenantId(tenantId);
    const record = await this.model.findFirst({
      where: { organization_id: tenantId, ...where },
      select: { id: true },
    });
    return record !== null;
  }
}

export default BaseRepository;