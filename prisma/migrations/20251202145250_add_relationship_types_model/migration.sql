/*
  Warnings:

  - You are about to drop the column `relationshipType` on the `relationships` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "relationships" DROP COLUMN "relationshipType",
ADD COLUMN     "relationshipTypeId" TEXT;

-- DropEnum
DROP TYPE "RelationshipType";

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
CREATE INDEX "relationship_types_userId_idx" ON "relationship_types"("userId");

-- CreateIndex
CREATE INDEX "relationships_relationshipTypeId_idx" ON "relationships"("relationshipTypeId");

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_relationshipTypeId_fkey" FOREIGN KEY ("relationshipTypeId") REFERENCES "relationship_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_types" ADD CONSTRAINT "relationship_types_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_types" ADD CONSTRAINT "relationship_types_inverseId_fkey" FOREIGN KEY ("inverseId") REFERENCES "relationship_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
