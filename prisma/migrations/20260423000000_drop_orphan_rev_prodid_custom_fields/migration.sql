-- Remove CardDAV REV / PRODID properties that were previously captured as custom
-- fields. They are server-authored metadata (revision timestamps, tool IDs) with
-- no user-facing value, and round-tripping them accumulated duplicates. One
-- variant with stray backslash escaping ("...T06\:54\:04Z") caused the generated
-- vCard to be rejected by Google Contacts CardDAV with 400 INVALID_ARGUMENT.
-- The parser no longer captures these; this cleanup removes the stragglers.
DELETE FROM "person_custom_fields"
WHERE key IN ('REV', 'PRODID', 'X-REV', 'X-PRODID');
