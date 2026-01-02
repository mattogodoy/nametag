import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Models that support soft delete
const SOFT_DELETE_MODELS = ['Person', 'Group', 'Relationship', 'RelationshipType', 'ImportantDate'] as const;
type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number];

function isSoftDeleteModel(model: string): model is SoftDeleteModel {
  return SOFT_DELETE_MODELS.includes(model as SoftDeleteModel);
}

// Create a base Prisma client
function createBaseClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['query', 'info', 'warn', 'error'],
  });
}

// Create an extended Prisma client with soft-delete filtering
function createExtendedClient() {
  const baseClient = createBaseClient();

  return baseClient.$extends({
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
};

export const prisma = globalForPrisma.prisma ?? createExtendedClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Returns a raw Prisma client without soft-delete filtering.
 * Use this for:
 * - Restore operations (need to find soft-deleted records)
 * - Purge operations (need to permanently delete old records)
 * - Admin/debugging queries
 *
 * IMPORTANT: Always call .$disconnect() when done to avoid connection leaks.
 */
export function withDeleted(): PrismaClient {
  return createBaseClient();
}

// Graceful shutdown handlers
async function gracefulShutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
