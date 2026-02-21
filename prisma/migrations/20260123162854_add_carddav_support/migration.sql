-- AlterTable: Add vCard and CardDAV fields to Person model
ALTER TABLE "people" ADD COLUMN "prefix" TEXT,
ADD COLUMN "suffix" TEXT,
ADD COLUMN "uid" TEXT,
ADD COLUMN "organization" TEXT,
ADD COLUMN "jobTitle" TEXT,
ADD COLUMN "photo" TEXT,
ADD COLUMN "gender" TEXT,
ADD COLUMN "anniversary" TIMESTAMP(3),
ADD COLUMN "cardDavSyncEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex: Unique UID per user
CREATE UNIQUE INDEX "people_userId_uid_key" ON "people"("userId", "uid");

-- CreateTable: PersonPhone
CREATE TABLE "person_phones" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PersonEmail
CREATE TABLE "person_emails" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PersonAddress
CREATE TABLE "person_addresses" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "streetLine1" TEXT,
    "streetLine2" TEXT,
    "locality" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PersonUrl
CREATE TABLE "person_urls" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PersonIM
CREATE TABLE "person_im_handles" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_im_handles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PersonLocation
CREATE TABLE "person_locations" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PersonCustomField
CREATE TABLE "person_custom_fields" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CardDavConnection
CREATE TABLE "carddav_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverUrl" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "provider" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoSyncInterval" INTEGER NOT NULL DEFAULT 43200,
    "lastSyncAt" TIMESTAMP(3),
    "syncToken" TEXT,
    "autoExportNew" BOOLEAN NOT NULL DEFAULT true,
    "importMode" TEXT NOT NULL DEFAULT 'manual',
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "syncInProgress" BOOLEAN NOT NULL DEFAULT false,
    "syncStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carddav_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CardDavMapping
CREATE TABLE "carddav_mappings" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "etag" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastLocalChange" TIMESTAMP(3),
    "lastRemoteChange" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',
    "localVersion" TEXT,
    "remoteVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carddav_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CardDavPendingImport
CREATE TABLE "carddav_pending_imports" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT,
    "uploadedByUserId" TEXT,
    "uid" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "etag" TEXT,
    "vCardData" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "carddav_pending_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CardDavConflict
CREATE TABLE "carddav_conflicts" (
    "id" TEXT NOT NULL,
    "mappingId" TEXT NOT NULL,
    "localVersion" TEXT NOT NULL,
    "remoteVersion" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carddav_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Multi-value contact tables
CREATE INDEX "person_phones_personId_idx" ON "person_phones"("personId");
CREATE INDEX "person_emails_personId_idx" ON "person_emails"("personId");
CREATE INDEX "person_addresses_personId_idx" ON "person_addresses"("personId");
CREATE INDEX "person_urls_personId_idx" ON "person_urls"("personId");
CREATE INDEX "person_im_handles_personId_idx" ON "person_im_handles"("personId");
CREATE INDEX "person_locations_personId_idx" ON "person_locations"("personId");
CREATE INDEX "person_custom_fields_personId_idx" ON "person_custom_fields"("personId");

-- CreateIndex: CardDAV tables
CREATE UNIQUE INDEX "carddav_connections_userId_key" ON "carddav_connections"("userId");
CREATE UNIQUE INDEX "carddav_mappings_personId_key" ON "carddav_mappings"("personId");
CREATE UNIQUE INDEX "carddav_mappings_connectionId_uid_key" ON "carddav_mappings"("connectionId", "uid");
CREATE INDEX "carddav_mappings_connectionId_idx" ON "carddav_mappings"("connectionId");
CREATE INDEX "carddav_mappings_syncStatus_idx" ON "carddav_mappings"("syncStatus");
CREATE UNIQUE INDEX "carddav_pending_imports_connectionId_uid_key" ON "carddav_pending_imports"("connectionId", "uid");
CREATE INDEX "carddav_pending_imports_connectionId_idx" ON "carddav_pending_imports"("connectionId");
CREATE INDEX "carddav_pending_imports_uploadedByUserId_idx" ON "carddav_pending_imports"("uploadedByUserId");
CREATE INDEX "carddav_conflicts_mappingId_idx" ON "carddav_conflicts"("mappingId");
CREATE INDEX "carddav_conflicts_resolvedAt_idx" ON "carddav_conflicts"("resolvedAt");

-- AddForeignKey: Multi-value contact tables
ALTER TABLE "person_phones" ADD CONSTRAINT "person_phones_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_emails" ADD CONSTRAINT "person_emails_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_addresses" ADD CONSTRAINT "person_addresses_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_urls" ADD CONSTRAINT "person_urls_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_im_handles" ADD CONSTRAINT "person_im_handles_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_locations" ADD CONSTRAINT "person_locations_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_custom_fields" ADD CONSTRAINT "person_custom_fields_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CardDAV tables
ALTER TABLE "carddav_connections" ADD CONSTRAINT "carddav_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carddav_mappings" ADD CONSTRAINT "carddav_mappings_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "carddav_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carddav_mappings" ADD CONSTRAINT "carddav_mappings_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carddav_pending_imports" ADD CONSTRAINT "carddav_pending_imports_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "carddav_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carddav_pending_imports" ADD CONSTRAINT "carddav_pending_imports_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carddav_conflicts" ADD CONSTRAINT "carddav_conflicts_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "carddav_mappings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
