-- CreateTable
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_events_eventId_key" ON "stripe_events"("eventId");

-- CreateIndex
CREATE INDEX "stripe_events_processedAt_idx" ON "stripe_events"("processedAt");
