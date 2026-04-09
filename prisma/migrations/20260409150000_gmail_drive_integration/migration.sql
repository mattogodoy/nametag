-- CreateTable
CREATE TABLE "google_integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authMode" TEXT NOT NULL DEFAULT 'oauth',
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "serviceAccountKey" TEXT,
    "delegatedEmail" TEXT,
    "gmailSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "driveSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastGmailSyncAt" TIMESTAMP(3),
    "gmailHistoryId" TEXT,
    "autoSyncInterval" INTEGER NOT NULL DEFAULT 3600,
    "driveRootFolderId" TEXT,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "syncInProgress" BOOLEAN NOT NULL DEFAULT false,
    "syncStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "subject" TEXT,
    "snippet" TEXT,
    "body" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmails" TEXT[],
    "ccEmails" TEXT[],
    "date" TIMESTAMP(3) NOT NULL,
    "labelIds" TEXT[],
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_log_people" (
    "id" TEXT NOT NULL,
    "emailLogId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "email_log_people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "personId" TEXT,
    "emailLogId" TEXT,
    "driveFileId" TEXT NOT NULL,
    "driveFolderId" TEXT,
    "driveWebViewUrl" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "source" TEXT NOT NULL,
    "ocrText" TEXT,
    "ocrStatus" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_integrations_userId_key" ON "google_integrations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "email_logs_integrationId_gmailMessageId_key" ON "email_logs"("integrationId", "gmailMessageId");

-- CreateIndex
CREATE INDEX "email_logs_integrationId_date_idx" ON "email_logs"("integrationId", "date");

-- CreateIndex
CREATE INDEX "email_logs_fromEmail_idx" ON "email_logs"("fromEmail");

-- CreateIndex
CREATE UNIQUE INDEX "email_log_people_emailLogId_personId_role_key" ON "email_log_people"("emailLogId", "personId", "role");

-- CreateIndex
CREATE INDEX "email_log_people_personId_idx" ON "email_log_people"("personId");

-- CreateIndex
CREATE INDEX "documents_integrationId_idx" ON "documents"("integrationId");

-- CreateIndex
CREATE INDEX "documents_personId_idx" ON "documents"("personId");

-- CreateIndex
CREATE INDEX "documents_emailLogId_idx" ON "documents"("emailLogId");

-- CreateIndex
CREATE INDEX "documents_ocrStatus_idx" ON "documents"("ocrStatus");

-- AddForeignKey
ALTER TABLE "google_integrations" ADD CONSTRAINT "google_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "google_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log_people" ADD CONSTRAINT "email_log_people_emailLogId_fkey" FOREIGN KEY ("emailLogId") REFERENCES "email_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log_people" ADD CONSTRAINT "email_log_people_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "google_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_emailLogId_fkey" FOREIGN KEY ("emailLogId") REFERENCES "email_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
