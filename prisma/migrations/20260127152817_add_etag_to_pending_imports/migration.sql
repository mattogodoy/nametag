-- AlterTable
ALTER TABLE "carddav_pending_imports" ADD COLUMN     "etag" TEXT;

-- AddForeignKey
ALTER TABLE "carddav_conflicts" ADD CONSTRAINT "carddav_conflicts_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "carddav_mappings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
