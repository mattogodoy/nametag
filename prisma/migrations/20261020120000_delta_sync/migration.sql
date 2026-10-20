-- AlterTable
ALTER TABLE "users" ADD COLUMN     "syncSeq" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "syncTombstoneFloor" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "people" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "relationships" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "important_dates" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "relationship_types" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "custom_field_templates" ADD COLUMN     "syncVersion" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "sync_tombstones" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "syncVersion" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_tombstones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_tombstones_userId_syncVersion_idx" ON "sync_tombstones"("userId", "syncVersion");

-- CreateIndex
CREATE INDEX "sync_tombstones_deletedAt_idx" ON "sync_tombstones"("deletedAt");

-- CreateIndex
CREATE INDEX "people_userId_syncVersion_idx" ON "people"("userId", "syncVersion");

-- CreateIndex
CREATE INDEX "groups_userId_syncVersion_idx" ON "groups"("userId", "syncVersion");

-- CreateIndex
CREATE INDEX "journal_entries_userId_syncVersion_idx" ON "journal_entries"("userId", "syncVersion");

-- CreateIndex
CREATE INDEX "relationships_personId_syncVersion_idx" ON "relationships"("personId", "syncVersion");

-- CreateIndex
CREATE INDEX "important_dates_personId_syncVersion_idx" ON "important_dates"("personId", "syncVersion");

-- CreateIndex
CREATE INDEX "relationship_types_userId_syncVersion_idx" ON "relationship_types"("userId", "syncVersion");

-- CreateIndex
CREATE INDEX "custom_field_templates_userId_syncVersion_idx" ON "custom_field_templates"("userId", "syncVersion");

-- AddForeignKey
ALTER TABLE "sync_tombstones" ADD CONSTRAINT "sync_tombstones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Delta sync: every write to a synced table takes the next value of the
-- owner's counter. The UPDATE locks the user row, so one user's writes are
-- numbered in commit order and a reader can never skip one.
CREATE OR REPLACE FUNCTION nametag_sync_next(p_user TEXT) RETURNS BIGINT AS $$
DECLARE
  v BIGINT;
BEGIN
  UPDATE "users" SET "syncSeq" = "syncSeq" + 1 WHERE "id" = p_user RETURNING "syncSeq" INTO v;
  RETURN v; -- NULL when the user row is gone (account deletion cascade)
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION nametag_sync_stamp_by_user() RETURNS TRIGGER AS $$
BEGIN
  NEW."syncVersion" := COALESCE(nametag_sync_next(NEW."userId"), NEW."syncVersion");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION nametag_sync_stamp_by_person() RETURNS TRIGGER AS $$
DECLARE
  owner TEXT;
BEGIN
  SELECT "userId" INTO owner FROM "people" WHERE "id" = NEW."personId";
  NEW."syncVersion" := COALESCE(nametag_sync_next(owner), NEW."syncVersion");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_stamp BEFORE INSERT OR UPDATE ON "people"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_stamp_by_user();
CREATE TRIGGER sync_stamp BEFORE INSERT OR UPDATE ON "groups"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_stamp_by_user();
CREATE TRIGGER sync_stamp BEFORE INSERT OR UPDATE ON "relationship_types"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_stamp_by_user();
CREATE TRIGGER sync_stamp BEFORE INSERT OR UPDATE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_stamp_by_user();
CREATE TRIGGER sync_stamp BEFORE INSERT OR UPDATE ON "custom_field_templates"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_stamp_by_user();
CREATE TRIGGER sync_stamp BEFORE INSERT OR UPDATE ON "relationships"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_stamp_by_person();
CREATE TRIGGER sync_stamp BEFORE INSERT OR UPDATE ON "important_dates"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_stamp_by_person();
