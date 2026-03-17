-- AlterTable: add nullable type column
ALTER TABLE "important_dates" ADD COLUMN "type" TEXT;

-- Backfill: match existing titles in all 6 supported languages (case-insensitive, trimmed)
-- Note: Spanish "Memorial" matches via the English entry (same word in both languages)
UPDATE "important_dates" SET "type" = 'birthday', "title" = ''
WHERE TRIM(LOWER("title")) IN ('birthday', 'cumpleaños', 'geburtstag', '誕生日', 'bursdag', '生日');

UPDATE "important_dates" SET "type" = 'anniversary', "title" = ''
WHERE TRIM(LOWER("title")) IN ('anniversary', 'aniversario', 'jahrestag', '記念日', 'jubileum', '周年纪念');

UPDATE "important_dates" SET "type" = 'nameday', "title" = ''
WHERE TRIM(LOWER("title")) IN ('name day', 'día del santo', 'namenstag', '名前の日', 'navnedag', '命名日');

UPDATE "important_dates" SET "type" = 'memorial', "title" = ''
WHERE TRIM(LOWER("title")) IN ('memorial', 'gedenktag', '追悼日', 'minnedag', '追悼纪念日');

-- Deduplicate: if a person has multiple dates with the same type after backfill,
-- keep only the oldest one (by id) and reset the rest to custom (type = NULL, restore title)
WITH duplicates AS (
  SELECT id, "type",
    ROW_NUMBER() OVER (PARTITION BY "personId", "type" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "important_dates"
  WHERE "type" IS NOT NULL AND "deletedAt" IS NULL
)
UPDATE "important_dates"
SET "type" = NULL, "title" = (
  SELECT CASE
    WHEN "important_dates"."type" = 'birthday' THEN 'Birthday'
    WHEN "important_dates"."type" = 'anniversary' THEN 'Anniversary'
    WHEN "important_dates"."type" = 'nameday' THEN 'Name day'
    WHEN "important_dates"."type" = 'memorial' THEN 'Memorial'
    ELSE 'Important Date'
  END
)
FROM duplicates
WHERE "important_dates".id = duplicates.id AND duplicates.rn > 1;

-- Note: uniqueness of (personId, type) for predefined types is enforced at the
-- application layer (POST/PUT/restore endpoints) rather than via a partial unique
-- index, because Prisma doesn't support partial indexes and would generate drift
-- migrations to drop it on every `prisma migrate dev`.
