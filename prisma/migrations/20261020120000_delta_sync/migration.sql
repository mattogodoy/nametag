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
CREATE INDEX "sync_tombstones_entityType_entityId_idx" ON "sync_tombstones"("entityType", "entityId");

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

-- The stamp triggers step aside while nametag_sync_backfill() runs, so the
-- backfill can write its own numbers even when the triggers exist.
CREATE OR REPLACE FUNCTION nametag_sync_stamp_by_user() RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('nametag.sync_backfill', true) = 'on' THEN RETURN NEW; END IF;
  NEW."syncVersion" := COALESCE(nametag_sync_next(NEW."userId"), NEW."syncVersion");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION nametag_sync_stamp_by_person() RETURNS TRIGGER AS $$
DECLARE
  owner TEXT;
BEGIN
  IF current_setting('nametag.sync_backfill', true) = 'on' THEN RETURN NEW; END IF;
  SELECT "userId" INTO owner FROM "people" WHERE "id" = NEW."personId";
  NEW."syncVersion" := COALESCE(nametag_sync_next(owner), NEW."syncVersion");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Rows that exist before this migration start at syncVersion 0, and a reader
-- only returns rows above its cursor, so they would never sync. This numbers
-- each user's existing rows 1..n (by table, then createdAt, then id) and sets
-- the user's counter to n. It is set-based so large instances stay fast.
CREATE OR REPLACE FUNCTION nametag_sync_backfill() RETURNS void AS $$
BEGIN
  PERFORM set_config('nametag.sync_backfill', 'on', true);

  DROP TABLE IF EXISTS _nametag_sync_backfill;
  CREATE TEMP TABLE _nametag_sync_backfill AS
  SELECT s.tbl, s.id, s.uid,
         row_number() OVER (PARTITION BY s.uid ORDER BY s.tbl, s.created, s.id) AS v
  FROM (
    SELECT 1 AS tbl, "id", "userId" AS uid, "createdAt" AS created FROM "people"
    UNION ALL SELECT 2, "id", "userId", "createdAt" FROM "groups"
    UNION ALL SELECT 3, "id", "userId", "createdAt" FROM "relationship_types"
    UNION ALL SELECT 4, "id", "userId", "createdAt" FROM "journal_entries"
    UNION ALL SELECT 5, "id", "userId", "createdAt" FROM "custom_field_templates"
    UNION ALL SELECT 6, r."id", p."userId", r."createdAt"
      FROM "relationships" r JOIN "people" p ON p."id" = r."personId"
    UNION ALL SELECT 7, d."id", p."userId", d."createdAt"
      FROM "important_dates" d JOIN "people" p ON p."id" = d."personId"
  ) s;

  UPDATE "people" t SET "syncVersion" = b.v FROM _nametag_sync_backfill b WHERE b.tbl = 1 AND b.id = t."id";
  UPDATE "groups" t SET "syncVersion" = b.v FROM _nametag_sync_backfill b WHERE b.tbl = 2 AND b.id = t."id";
  UPDATE "relationship_types" t SET "syncVersion" = b.v FROM _nametag_sync_backfill b WHERE b.tbl = 3 AND b.id = t."id";
  UPDATE "journal_entries" t SET "syncVersion" = b.v FROM _nametag_sync_backfill b WHERE b.tbl = 4 AND b.id = t."id";
  UPDATE "custom_field_templates" t SET "syncVersion" = b.v FROM _nametag_sync_backfill b WHERE b.tbl = 5 AND b.id = t."id";
  UPDATE "relationships" t SET "syncVersion" = b.v FROM _nametag_sync_backfill b WHERE b.tbl = 6 AND b.id = t."id";
  UPDATE "important_dates" t SET "syncVersion" = b.v FROM _nametag_sync_backfill b WHERE b.tbl = 7 AND b.id = t."id";

  UPDATE "users" u SET "syncSeq" = c.n
  FROM (SELECT uid, max(v) AS n FROM _nametag_sync_backfill GROUP BY uid) c
  WHERE u."id" = c.uid;

  DROP TABLE _nametag_sync_backfill;
  PERFORM set_config('nametag.sync_backfill', 'off', true);
END;
$$ LANGUAGE plpgsql;

-- Runs before the stamp triggers exist. Kept defined afterwards for tests.
SELECT nametag_sync_backfill();

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

-- Child rows carry no sync columns; touching the parent restamps it through
-- its own sync_stamp trigger. A parent that is being deleted matches no row.
CREATE OR REPLACE FUNCTION nametag_sync_touch_person() RETURNS TRIGGER AS $$
DECLARE
  pid TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN pid := OLD."personId"; ELSE pid := NEW."personId"; END IF;
  UPDATE "people" SET "syncVersion" = "syncVersion" WHERE "id" = pid;
  IF TG_OP = 'UPDATE' AND OLD."personId" IS DISTINCT FROM NEW."personId" THEN
    UPDATE "people" SET "syncVersion" = "syncVersion" WHERE "id" = OLD."personId";
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION nametag_sync_touch_journal() RETURNS TRIGGER AS $$
DECLARE
  jid TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN jid := OLD."journalEntryId"; ELSE jid := NEW."journalEntryId"; END IF;
  UPDATE "journal_entries" SET "syncVersion" = "syncVersion" WHERE "id" = jid;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_touch AFTER INSERT OR UPDATE OR DELETE ON "person_phones"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_touch_person();
CREATE TRIGGER sync_touch AFTER INSERT OR UPDATE OR DELETE ON "person_emails"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_touch_person();
CREATE TRIGGER sync_touch AFTER INSERT OR UPDATE OR DELETE ON "person_addresses"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_touch_person();
CREATE TRIGGER sync_touch AFTER INSERT OR UPDATE OR DELETE ON "person_urls"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_touch_person();
CREATE TRIGGER sync_touch AFTER INSERT OR UPDATE OR DELETE ON "person_im_handles"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_touch_person();
CREATE TRIGGER sync_touch AFTER INSERT OR UPDATE OR DELETE ON "person_locations"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_touch_person();
CREATE TRIGGER sync_touch AFTER INSERT OR UPDATE OR DELETE ON "person_custom_fields"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_touch_person();
CREATE TRIGGER sync_touch AFTER INSERT OR UPDATE OR DELETE ON "person_custom_field_values"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_touch_person();
CREATE TRIGGER sync_touch AFTER INSERT OR UPDATE OR DELETE ON "person_groups"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_touch_person();
CREATE TRIGGER sync_touch AFTER INSERT OR UPDATE OR DELETE ON "journal_entry_people"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_touch_journal();

-- Hard deletes leave a tombstone. These run BEFORE DELETE on purpose: the
-- internal cascade triggers sort ahead of ours, so with AFTER DELETE a cascaded
-- child would run before its person's tombstone exists. BEFORE DELETE writes the
-- parent's tombstone first, and a cascaded child (whose person row is already
-- gone) finds its owner there. TG_ARGV[0] is the entity type the API reports.
CREATE OR REPLACE FUNCTION nametag_sync_tombstone_by_user() RETURNS TRIGGER AS $$
DECLARE
  v BIGINT;
BEGIN
  v := nametag_sync_next(OLD."userId");
  IF v IS NOT NULL THEN
    INSERT INTO "sync_tombstones" ("id", "userId", "entityType", "entityId", "syncVersion", "deletedAt")
    VALUES (gen_random_uuid()::text, OLD."userId", TG_ARGV[0], OLD."id", v, now());
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION nametag_sync_tombstone_by_person() RETURNS TRIGGER AS $$
DECLARE
  owner TEXT;
  v BIGINT;
BEGIN
  SELECT "userId" INTO owner FROM "people" WHERE "id" = OLD."personId";
  IF owner IS NULL THEN
    -- Cascade from a person delete: the person row is gone, its tombstone is not.
    SELECT "userId" INTO owner FROM "sync_tombstones"
      WHERE "entityType" = 'person' AND "entityId" = OLD."personId"
      ORDER BY "syncVersion" DESC LIMIT 1;
  END IF;
  IF owner IS NOT NULL THEN
    v := nametag_sync_next(owner);
    IF v IS NOT NULL THEN
      INSERT INTO "sync_tombstones" ("id", "userId", "entityType", "entityId", "syncVersion", "deletedAt")
      VALUES (gen_random_uuid()::text, owner, TG_ARGV[0], OLD."id", v, now());
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_tombstone BEFORE DELETE ON "people"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_tombstone_by_user('person');
CREATE TRIGGER sync_tombstone BEFORE DELETE ON "groups"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_tombstone_by_user('group');
CREATE TRIGGER sync_tombstone BEFORE DELETE ON "relationship_types"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_tombstone_by_user('relationshipType');
CREATE TRIGGER sync_tombstone BEFORE DELETE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_tombstone_by_user('journalEntry');
CREATE TRIGGER sync_tombstone BEFORE DELETE ON "custom_field_templates"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_tombstone_by_user('customFieldTemplate');
CREATE TRIGGER sync_tombstone BEFORE DELETE ON "relationships"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_tombstone_by_person('relationship');
CREATE TRIGGER sync_tombstone BEFORE DELETE ON "important_dates"
  FOR EACH ROW EXECUTE FUNCTION nametag_sync_tombstone_by_person('importantDate');
