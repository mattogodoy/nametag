-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('ONCE', 'RECURRING');

-- CreateEnum
CREATE TYPE "ReminderIntervalUnit" AS ENUM ('WEEKS', 'MONTHS', 'YEARS');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "DateFormat" AS ENUM ('MDY', 'DMY', 'YMD');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT,
    "nickname" TEXT,
    "theme" "Theme" NOT NULL DEFAULT 'LIGHT',
    "dateFormat" "DateFormat" NOT NULL DEFAULT 'MDY',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "emailVerifyExpires" TIMESTAMP(3),
    "emailVerifySentAt" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "passwordResetSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT,
    "nickname" TEXT,
    "lastContact" TIMESTAMP(3),
    "notes" TEXT,
    "relationshipToUserId" TEXT,
    "contactReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "contactReminderInterval" INTEGER,
    "contactReminderIntervalUnit" "ReminderIntervalUnit",
    "lastContactReminderSent" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_groups" (
    "personId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_groups_pkey" PRIMARY KEY ("personId","groupId")
);

-- CreateTable
CREATE TABLE "relationships" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "relatedPersonId" TEXT NOT NULL,
    "relationshipTypeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "important_dates" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderType" "ReminderType",
    "reminderInterval" INTEGER,
    "reminderIntervalUnit" "ReminderIntervalUnit",
    "lastReminderSent" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "important_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_types" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "inverseId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_emailVerifyToken_key" ON "users"("emailVerifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_passwordResetToken_key" ON "users"("passwordResetToken");

-- CreateIndex
CREATE INDEX "people_userId_idx" ON "people"("userId");

-- CreateIndex
CREATE INDEX "people_relationshipToUserId_idx" ON "people"("relationshipToUserId");

-- CreateIndex
CREATE INDEX "people_userId_lastContact_idx" ON "people"("userId", "lastContact");

-- CreateIndex
CREATE INDEX "people_userId_name_idx" ON "people"("userId", "name");

-- CreateIndex
CREATE INDEX "people_userId_surname_idx" ON "people"("userId", "surname");

-- CreateIndex
CREATE INDEX "people_userId_nickname_idx" ON "people"("userId", "nickname");

-- CreateIndex
CREATE INDEX "people_contactReminderEnabled_lastContact_idx" ON "people"("contactReminderEnabled", "lastContact");

-- CreateIndex
CREATE INDEX "groups_userId_idx" ON "groups"("userId");

-- CreateIndex
CREATE INDEX "person_groups_personId_idx" ON "person_groups"("personId");

-- CreateIndex
CREATE INDEX "person_groups_groupId_idx" ON "person_groups"("groupId");

-- CreateIndex
CREATE INDEX "relationships_personId_idx" ON "relationships"("personId");

-- CreateIndex
CREATE INDEX "relationships_relatedPersonId_idx" ON "relationships"("relatedPersonId");

-- CreateIndex
CREATE INDEX "relationships_relationshipTypeId_idx" ON "relationships"("relationshipTypeId");

-- CreateIndex
CREATE INDEX "important_dates_personId_idx" ON "important_dates"("personId");

-- CreateIndex
CREATE INDEX "important_dates_personId_date_idx" ON "important_dates"("personId", "date");

-- CreateIndex
CREATE INDEX "important_dates_reminderEnabled_date_idx" ON "important_dates"("reminderEnabled", "date");

-- CreateIndex
CREATE INDEX "relationship_types_userId_idx" ON "relationship_types"("userId");

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_relationshipToUserId_fkey" FOREIGN KEY ("relationshipToUserId") REFERENCES "relationship_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_groups" ADD CONSTRAINT "person_groups_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_groups" ADD CONSTRAINT "person_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_relatedPersonId_fkey" FOREIGN KEY ("relatedPersonId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_relationshipTypeId_fkey" FOREIGN KEY ("relationshipTypeId") REFERENCES "relationship_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "important_dates" ADD CONSTRAINT "important_dates_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_types" ADD CONSTRAINT "relationship_types_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_types" ADD CONSTRAINT "relationship_types_inverseId_fkey" FOREIGN KEY ("inverseId") REFERENCES "relationship_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
