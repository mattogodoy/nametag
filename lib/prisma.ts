import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getEnv } from './env';
import { isDeadlock, withDeadlockRetry } from './db/deadlock';

// Models that support soft delete
const SOFT_DELETE_MODELS = ['Person', 'Group', 'Relationship', 'RelationshipType', 'ImportantDate'] as const;
type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number];

function isSoftDeleteModel(model: string): model is SoftDeleteModel {
  return SOFT_DELETE_MODELS.includes(model as SoftDeleteModel);
}

// Create a base Prisma client
function createBaseClient() {
  // Ensure env validation runs and DATABASE_URL is constructed if needed
  const env = getEnv();

  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
  });

  return new PrismaClient({
    adapter,
    // Sync internals are hidden by default: BigInt does not serialize to JSON,
    // so any route returning a whole row would throw. Sync code opts in per
    // query with `omit: { syncVersion: false }`.
    omit: {
      person: { syncVersion: true },
      group: { syncVersion: true },
      relationship: { syncVersion: true },
      importantDate: { syncVersion: true },
      relationshipType: { syncVersion: true },
      journalEntry: { syncVersion: true },
      customFieldTemplate: { syncVersion: true },
      user: { syncSeq: true, syncTombstoneFloor: true },
    },
    log:
      env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['query', 'info', 'warn', 'error'],
  });
}

/**
 * True when Prisma says a query runs outside any transaction. Prisma exposes
 * this only through the undocumented `__internalParams.transaction` (kind
 * "batch" or "itx" inside one). If that shape ever changes, this answers
 * false, so nothing is rerun rather than rerun outside its transaction.
 * tests/db/sync-deadlock.db.test.ts pins the behavior.
 */
function isStandalone(params: object): boolean {
  if (!('__internalParams' in params)) return false;
  const internal = params.__internalParams;
  return typeof internal === 'object' && internal !== null
    && (!('transaction' in internal) || internal.transaction === undefined || internal.transaction === null);
}

// Create an extended Prisma client with soft-delete filtering
function createExtendedClient() {
  const baseClient = createBaseClient();

  return baseClient.$extends({
    // A standalone write can be the victim of a delta sync deadlock (see
    // lib/db/deadlock.ts); it committed nothing, so it is run again.
    // Queries inside a transaction are never rerun here: the deadlock aborted
    // the whole transaction, and rerunning one statement of a batch would run
    // it on its own, outside the batch. Those callers wrap the whole
    // transaction in withDeadlockRetry instead.
    name: 'deadlockRetry',
    query: {
      async $allOperations(params) {
        const { args, query } = params;
        try {
          return await query(args);
        } catch (error) {
          if (!isDeadlock(error) || !isStandalone(params)) throw error;
          return withDeadlockRetry(() => query(args));
        }
      },
    },
  }).$extends({
    name: 'softDelete',
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            // findUnique needs special handling - run query then check deletedAt
            const result = await query(args);
            if (
              result &&
              typeof result === 'object' &&
              'deletedAt' in result &&
              result.deletedAt !== null
            ) {
              return null;
            }
            return result;
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
        },
        async groupBy({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
        },
      },
    },
  });
}

// Type for the extended client
type ExtendedPrismaClient = ReturnType<typeof createExtendedClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
  prismaIncludingDeleted: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createExtendedClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Prisma client without the soft-delete filter, so queries see soft-deleted
 * rows. Use it for:
 * - Restore operations (need to find soft-deleted records)
 * - Purge operations (need to permanently delete old records)
 * - Trash listings
 *
 * A shared singleton with its own connection pool, like `prisma`. Callers must
 * NOT disconnect it: it outlives any single request.
 *
 * Every read through this client is unfiltered, so scope it deliberately. Reach
 * for `prisma` unless the query is specifically about deleted rows.
 */
export const prismaIncludingDeleted: PrismaClient =
  globalForPrisma.prismaIncludingDeleted ?? createBaseClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaIncludingDeleted = prismaIncludingDeleted;
}

// Graceful shutdown handlers - guarded to prevent duplicate registration during hot reload
const globalForShutdown = globalThis as unknown as { __prismaShutdownRegistered?: boolean };
if (!globalForShutdown.__prismaShutdownRegistered) {
  globalForShutdown.__prismaShutdownRegistered = true;
  const gracefulShutdown = async () => {
    await Promise.allSettled([
      prisma.$disconnect(),
      prismaIncludingDeleted.$disconnect(),
    ]);
    process.exit(0);
  };
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}
