-- AlterTable
ALTER TABLE "carddav_pending_imports" ADD COLUMN     "uploadedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "carddav_pending_imports_uploadedByUserId_idx" ON "carddav_pending_imports"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "carddav_pending_imports" ADD CONSTRAINT "carddav_pending_imports_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
