-- DropForeignKey
ALTER TABLE "people" DROP CONSTRAINT "people_relationshipToUserId_fkey";

-- AlterTable
ALTER TABLE "people" ALTER COLUMN "relationshipToUserId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "people_userId_lastContact_idx" ON "people"("userId", "lastContact");

-- CreateIndex
CREATE INDEX "people_userId_fullName_idx" ON "people"("userId", "fullName");

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_relationshipToUserId_fkey" FOREIGN KEY ("relationshipToUserId") REFERENCES "relationship_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
