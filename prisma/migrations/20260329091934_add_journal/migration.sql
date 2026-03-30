-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_people" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    CONSTRAINT "journal_entry_people_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "journal_entries_userId_date_idx" ON "journal_entries"("userId", "date");

-- CreateIndex
CREATE INDEX "journal_entries_userId_deletedAt_idx" ON "journal_entries"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "journal_entry_people_personId_idx" ON "journal_entry_people"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_people_journalEntryId_personId_key" ON "journal_entry_people"("journalEntryId", "personId");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_people" ADD CONSTRAINT "journal_entry_people_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_people" ADD CONSTRAINT "journal_entry_people_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
