-- CreateEnum
CREATE TYPE "LabelConditionSubject" AS ENUM ('DESCRIBED', 'OTHER');

-- CreateEnum
CREATE TYPE "LabelConditionSource" AS ENUM ('PERSON_FIELD', 'CUSTOM_FIELD', 'GROUP', 'DATE_TYPE', 'DATE_TITLE');

-- CreateEnum
CREATE TYPE "LabelConditionOperator" AS ENUM ('IS', 'IS_NOT', 'CONTAINS', 'NOT_CONTAINS', 'EQUALS', 'NOT_EQUALS', 'GT', 'GTE', 'LT', 'LTE', 'IS_TRUE', 'IS_FALSE', 'IN_GROUP', 'NOT_IN_GROUP', 'BEFORE', 'ON_OR_BEFORE', 'AFTER', 'ON_OR_AFTER', 'SAME_DAY', 'NOT_SAME_DAY', 'IS_SET', 'IS_NOT_SET');

-- CreateTable
CREATE TABLE "relationship_label_variants" (
    "id" TEXT NOT NULL,
    "relationshipTypeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_label_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_label_conditions" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "subject" "LabelConditionSubject" NOT NULL,
    "source" "LabelConditionSource" NOT NULL,
    "subjectRef" TEXT NOT NULL,
    "operator" "LabelConditionOperator" NOT NULL,
    "operand" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_label_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "relationship_label_variants_relationshipTypeId_order_idx" ON "relationship_label_variants"("relationshipTypeId", "order");

-- CreateIndex
CREATE INDEX "relationship_label_conditions_variantId_order_idx" ON "relationship_label_conditions"("variantId", "order");

-- AddForeignKey
ALTER TABLE "relationship_label_variants" ADD CONSTRAINT "relationship_label_variants_relationshipTypeId_fkey" FOREIGN KEY ("relationshipTypeId") REFERENCES "relationship_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_label_conditions" ADD CONSTRAINT "relationship_label_conditions_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "relationship_label_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
