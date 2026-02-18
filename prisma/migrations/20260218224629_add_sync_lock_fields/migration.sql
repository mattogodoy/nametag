-- AlterTable
ALTER TABLE "carddav_connections" ADD COLUMN     "syncInProgress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "syncStartedAt" TIMESTAMP(3),
ALTER COLUMN "autoSyncInterval" SET DEFAULT 43200;
