-- Data-only migration: the geocoding cascade now retries without the second
-- address line, so previously failed lookups may succeed. Drop the cached
-- negative results and re-queue failed addresses for the background cron.
DELETE FROM "geocode_cache" WHERE "status" = 'failed';
UPDATE "person_addresses" SET "geocodeStatus" = 'pending' WHERE "geocodeStatus" = 'failed';
