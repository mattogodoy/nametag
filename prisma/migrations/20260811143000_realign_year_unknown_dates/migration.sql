-- Data-only migration: the person form used to rewrite year-unknown dates with
-- setFullYear, which works in local time. Because year 1604 predates standard
-- time zones, JavaScript fell back to Local Mean Time and stored an instant
-- offset from UTC midnight by the difference between the server zone's 1604
-- LMT and its modern offset (for example Sydney wrote 1604-08-09T23:55:08Z for
-- August 10). Now that dates are read as UTC calendar days, those rows would
-- display and remind on the wrong day, so round them to the nearest UTC
-- midnight. The offset is always well under twelve hours, which makes nearest
-- midnight the day the user picked.
--
-- Rows written near a year boundary can round to 1605-01-01 (a January 1 saved
-- from a zone west of UTC); clamp those back to 1604-01-01 so they keep the
-- year-unknown sentinel. Correctly written rows sit exactly on UTC midnight
-- and are left untouched, as are known-year dates, which were never rewritten
-- with setFullYear.
UPDATE "important_dates"
SET "date" = CASE
  WHEN date_trunc('day', "date" + interval '12 hours') >= TIMESTAMP '1605-01-01'
    THEN TIMESTAMP '1604-01-01'
  ELSE date_trunc('day', "date" + interval '12 hours')
END
WHERE EXTRACT(YEAR FROM "date") BETWEEN 1603 AND 1605
  AND "date" <> date_trunc('day', "date");
