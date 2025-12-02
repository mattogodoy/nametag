/*
  Warnings:

  - Added the required column `relationshipToUserId` to the `people` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "people" ADD COLUMN     "relationshipToUserId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "people_relationshipToUserId_idx" ON "people"("relationshipToUserId");

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_relationshipToUserId_fkey" FOREIGN KEY ("relationshipToUserId") REFERENCES "relationship_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
