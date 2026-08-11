import { describe, it, expect } from 'vitest';
import { personToVCard, formatVCardV3Date } from '@/lib/carddav/vcard-export';
import { parseVCard } from '@/lib/carddav/vcard-parser';
import type { PersonWithRelations } from '@/lib/carddav/types';
import { withTimezone } from '../../helpers/timezone';

/**
 * Regression tests for issue #373 follow-up: calendar dates drifted one day
 * earlier on every CardDAV round trip for users east of UTC.
 *
 * `parseVCardDate` built dates at local midnight while `formatVCardV3Date`
 * reads UTC components, so in any timezone ahead of UTC a parsed date landed
 * on the previous UTC day. Each import shifted every date back by one, and the
 * sync engine re-exports afterwards, so the vCard (and its etag) changed on
 * every cycle. Nametag stores calendar dates as UTC midnight everywhere else
 * (see `lib/date-format.ts` and the important-dates API), so the parser is the
 * side that has to change.
 *
 * These tests pin the process timezone because the bug is invisible under UTC
 * and under any timezone west of UTC, which is why the existing suite passed.
 */

// Two zones ahead of UTC (where the bug appeared), one behind, plus UTC.
const TIMEZONES = ['UTC', 'Europe/Berlin', 'Australia/Sydney', 'America/New_York'];

function buildPerson(
  importantDates: PersonWithRelations['importantDates']
): PersonWithRelations {
  return {
    id: 'person-1',
    uid: 'uid-1',
    name: 'Jane',
    surname: 'Doe',
    phoneNumbers: [],
    emails: [],
    addresses: [],
    urls: [],
    imHandles: [],
    locations: [],
    customFields: [],
    customFieldValues: [],
    importantDates,
    groups: [],
  } as unknown as PersonWithRelations;
}

function dateLinesOf(vCard: string): string[] {
  return vCard
    .split(/\r?\n/)
    .filter((line) => /^(BDAY:|item\d+\.X-ABDATE|item\d+\.X-ABLabel)/.test(line))
    .sort();
}

function importantDate(
  type: string | null,
  title: string,
  iso: string
): PersonWithRelations['importantDates'][number] {
  return {
    id: `date-${type ?? title}`,
    type,
    title,
    date: new Date(iso),
    deletedAt: null,
  } as unknown as PersonWithRelations['importantDates'][number];
}

describe('vCard date timezone handling', () => {
  describe.each(TIMEZONES)('in %s', (tz) => {
    it('parses a v3 BDAY to UTC midnight, not local midnight', () => {
      withTimezone(tz, () => {
        const parsed = parseVCard(
          ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Jane Doe', 'BDAY:19800315', 'END:VCARD'].join('\r\n')
        );

        expect(parsed.importantDates).toHaveLength(1);
        expect(parsed.importantDates[0].date.toISOString()).toBe('1980-03-15T00:00:00.000Z');
      });
    });

    it('round-trips a parsed date back to the same wire value', () => {
      withTimezone(tz, () => {
        const parsed = parseVCard(
          ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Jane Doe', 'BDAY:19800315', 'END:VCARD'].join('\r\n')
        );

        expect(formatVCardV3Date(parsed.importantDates[0].date)).toBe('19800315');
      });
    });

    it('keeps every date stable across repeated export/import sync cycles', () => {
      withTimezone(tz, () => {
        let dates = [
          importantDate('birthday', '', '1980-03-15T00:00:00Z'),
          importantDate('anniversary', '', '2005-06-01T00:00:00Z'),
          importantDate('nameday', '', '2001-01-02T00:00:00Z'),
          importantDate(null, 'Graduation', '2010-09-09T00:00:00Z'),
        ];

        const emitted: string[][] = [];
        for (let cycle = 0; cycle < 4; cycle++) {
          const vCard = personToVCard(buildPerson(dates));
          emitted.push(dateLinesOf(vCard));
          dates = parseVCard(vCard).importantDates.map((d, i) =>
            importantDate(d.type ?? null, d.title || `date-${i}`, d.date.toISOString())
          );
        }

        // Every cycle must emit byte-identical date lines. Any difference means
        // the sync engine would rewrite the vCard (and bump the etag) forever.
        for (let cycle = 1; cycle < emitted.length; cycle++) {
          expect(emitted[cycle], `drifted on cycle ${cycle}`).toEqual(emitted[0]);
        }
        expect(emitted[0]).toContain('BDAY:19800315');
      });
    });

    it('does not shift year-omitted dates (--MMDD)', () => {
      withTimezone(tz, () => {
        const parsed = parseVCard(
          ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Jane Doe', 'BDAY:--0315', 'END:VCARD'].join('\r\n')
        );

        const date = parsed.importantDates[0].date;
        expect(date.getUTCMonth() + 1).toBe(3);
        expect(date.getUTCDate()).toBe(15);
        expect(formatVCardV3Date(date)).toBe('--0315');
      });
    });

    it('does not shift dates carrying X-APPLE-OMIT-YEAR', () => {
      withTimezone(tz, () => {
        const parsed = parseVCard(
          [
            'BEGIN:VCARD',
            'VERSION:3.0',
            'FN:Jane Doe',
            'BDAY;X-APPLE-OMIT-YEAR=1604:1604-03-15',
            'END:VCARD',
          ].join('\r\n')
        );

        const date = parsed.importantDates[0].date;
        expect(date.getUTCMonth() + 1).toBe(3);
        expect(date.getUTCDate()).toBe(15);
        expect(formatVCardV3Date(date)).toBe('--0315');
      });
    });
  });
});
