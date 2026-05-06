-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT');

-- CreateTable
CREATE TABLE "custom_field_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "custom_field_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_custom_field_values" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_field_templates_userId_deletedAt_idx" ON "custom_field_templates"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "custom_field_templates_userId_slug_idx" ON "custom_field_templates"("userId", "slug");

-- CreateIndex
-- Partial unique index: enforces uniqueness on (userId, slug) only for non-deleted rows.
-- This lets users recreate a template with the same name after soft-deleting the previous one.
CREATE UNIQUE INDEX "custom_field_templates_userId_slug_active_key"
  ON "custom_field_templates"("userId", "slug")
  WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "person_custom_field_values_templateId_value_idx" ON "person_custom_field_values"("templateId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "person_custom_field_values_personId_templateId_key" ON "person_custom_field_values"("personId", "templateId");

-- AddForeignKey
ALTER TABLE "custom_field_templates" ADD CONSTRAINT "custom_field_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_custom_field_values" ADD CONSTRAINT "person_custom_field_values_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_custom_field_values" ADD CONSTRAINT "person_custom_field_values_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "custom_field_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
