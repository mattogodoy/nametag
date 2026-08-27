-- AlterTable
ALTER TABLE "push_subscriptions" ADD COLUMN     "autoDisabledAt" TIMESTAMP(3),
ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastFailureCode" TEXT;
