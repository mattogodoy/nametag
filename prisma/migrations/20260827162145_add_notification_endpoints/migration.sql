-- CreateEnum
CREATE TYPE "NotificationEndpointType" AS ENUM ('NTFY', 'WEBHOOK');

-- CreateTable
CREATE TABLE "notification_endpoints" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationEndpointType" NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastFailureCode" TEXT,
    "autoDisabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_endpoints_userId_enabled_idx" ON "notification_endpoints"("userId", "enabled");

-- AddForeignKey
ALTER TABLE "notification_endpoints" ADD CONSTRAINT "notification_endpoints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
