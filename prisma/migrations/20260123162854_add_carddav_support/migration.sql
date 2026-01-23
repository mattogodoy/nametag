-- AlterTable: Add vCard fields to Person model
ALTER TABLE "people" ADD COLUMN "prefix" TEXT,
ADD COLUMN "suffix" TEXT,
ADD COLUMN "uid" TEXT,
ADD COLUMN "organization" TEXT,
ADD COLUMN "jobTitle" TEXT,
ADD COLUMN "role" TEXT,
ADD COLUMN "photo" TEXT,
ADD COLUMN "gender" TEXT,
ADD COLUMN "anniversary" TIMESTAMP(3);

-- CreateIndex: Add unique constraint on uid
CREATE UNIQUE INDEX "people_uid_key" ON "people"("uid");

-- CreateTable: PersonPhone
CREATE TABLE "person_phones" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PersonEmail
CREATE TABLE "person_emails" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PersonAddress
CREATE TABLE "person_addresses" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "street" TEXT,
    "locality" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PersonUrl
CREATE TABLE "person_urls" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
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
    "autoSyncInterval" INTEGER NOT NULL DEFAULT 300,
    "lastSyncAt" TIMESTAMP(3),
    "syncToken" TEXT,
    "autoExportNew" BOOLEAN NOT NULL DEFAULT true,
    "importMode" TEXT NOT NULL DEFAULT 'manual',
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
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
    "connectionId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "href" TEXT NOT NULL,
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

-- CreateIndex: person_phones
CREATE INDEX "person_phones_personId_idx" ON "person_phones"("personId");

-- CreateIndex: person_emails
CREATE INDEX "person_emails_personId_idx" ON "person_emails"("personId");

-- CreateIndex: person_addresses
CREATE INDEX "person_addresses_personId_idx" ON "person_addresses"("personId");

-- CreateIndex: person_urls
CREATE INDEX "person_urls_personId_idx" ON "person_urls"("personId");

-- CreateIndex: person_im_handles
CREATE INDEX "person_im_handles_personId_idx" ON "person_im_handles"("personId");

-- CreateIndex: person_locations
CREATE INDEX "person_locations_personId_idx" ON "person_locations"("personId");

-- CreateIndex: person_custom_fields
CREATE INDEX "person_custom_fields_personId_idx" ON "person_custom_fields"("personId");

-- CreateIndex: carddav_connections
CREATE UNIQUE INDEX "carddav_connections_userId_key" ON "carddav_connections"("userId");

-- CreateIndex: carddav_mappings
CREATE UNIQUE INDEX "carddav_mappings_personId_key" ON "carddav_mappings"("personId");
CREATE UNIQUE INDEX "carddav_mappings_connectionId_uid_key" ON "carddav_mappings"("connectionId", "uid");
CREATE INDEX "carddav_mappings_connectionId_idx" ON "carddav_mappings"("connectionId");
CREATE INDEX "carddav_mappings_syncStatus_idx" ON "carddav_mappings"("syncStatus");

-- CreateIndex: carddav_pending_imports
CREATE UNIQUE INDEX "carddav_pending_imports_connectionId_uid_key" ON "carddav_pending_imports"("connectionId", "uid");
CREATE INDEX "carddav_pending_imports_connectionId_idx" ON "carddav_pending_imports"("connectionId");

-- CreateIndex: carddav_conflicts
CREATE INDEX "carddav_conflicts_mappingId_idx" ON "carddav_conflicts"("mappingId");
CREATE INDEX "carddav_conflicts_resolvedAt_idx" ON "carddav_conflicts"("resolvedAt");

-- AddForeignKey: person_phones
ALTER TABLE "person_phones" ADD CONSTRAINT "person_phones_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: person_emails
ALTER TABLE "person_emails" ADD CONSTRAINT "person_emails_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: person_addresses
ALTER TABLE "person_addresses" ADD CONSTRAINT "person_addresses_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: person_urls
ALTER TABLE "person_urls" ADD CONSTRAINT "person_urls_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: person_im_handles
ALTER TABLE "person_im_handles" ADD CONSTRAINT "person_im_handles_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: person_locations
ALTER TABLE "person_locations" ADD CONSTRAINT "person_locations_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: person_custom_fields
ALTER TABLE "person_custom_fields" ADD CONSTRAINT "person_custom_fields_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: carddav_connections
ALTER TABLE "carddav_connections" ADD CONSTRAINT "carddav_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: carddav_mappings
ALTER TABLE "carddav_mappings" ADD CONSTRAINT "carddav_mappings_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "carddav_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "carddav_mappings" ADD CONSTRAINT "carddav_mappings_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: carddav_pending_imports
ALTER TABLE "carddav_pending_imports" ADD CONSTRAINT "carddav_pending_imports_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "carddav_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
