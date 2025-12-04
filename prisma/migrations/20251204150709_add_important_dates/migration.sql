-- CreateTable
CREATE TABLE "important_dates" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "important_dates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "important_dates_personId_idx" ON "important_dates"("personId");

-- CreateIndex
CREATE INDEX "important_dates_personId_date_idx" ON "important_dates"("personId", "date");

-- AddForeignKey
ALTER TABLE "important_dates" ADD CONSTRAINT "important_dates_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
