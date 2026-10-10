import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { person: { findMany: mocks.personFindMany } },
}));

import {
  advancedSearchPeople,
  filterAdvancedSearch,
  hasActiveFilters,
  parseAdvancedSearchFilters,
  type AdvancedSearchCandidate,
  type AdvancedSearchFilters,
} from '@/lib/advanced-search';

const emptyFilters: AdvancedSearchFilters = { name: '', location: '', email: '', phone: '', keywords: '' };

function person(overrides: Partial<AdvancedSearchCandidate>): AdvancedSearchCandidate {
  return {
    id: 'p',
    name: 'Someone',
    surname: null,
    middleName: null,
    secondLastName: null,
    nickname: null,
    displayNameOverride: null,
    notes: null,
    photo: null,
    emails: [],
    phoneNumbers: [],
    addresses: [],
    ...overrides,
  };
}

const maria = person({
  id: 'maria',
  name: 'María',
  surname: 'García',
  nickname: 'Majo',
  notes: 'Met at the climbing gym. Loves Japanese food.',
  emails: [{ email: 'Maria.Garcia@Example.com' }],
  phoneNumbers: [{ number: '+34 612 345 678' }],
  addresses: [{
    streetLine1: 'Calle Mayor 1',
    streetLine2: null,
    locality: 'Madrid',
    region: 'Comunidad de Madrid',
    postalCode: '28013',
    country: 'ES',
  }],
});

const john = person({
  id: 'john',
  name: 'John',
  surname: 'Smith',
  notes: 'Colleague from the Berlin office.',
  emails: [{ email: 'john@work.de' }, { email: 'jsmith@gmail.com' }],
  phoneNumbers: [{ number: '(030) 555-0101' }],
  addresses: [{
    streetLine1: null,
    streetLine2: null,
    locality: 'Berlin',
    region: null,
    postalCode: null,
    country: 'DE',
  }],
});

const russ = person({
  id: 'russ',
  name: 'Ivan',
  addresses: [{
    streetLine1: null,
    streetLine2: null,
    locality: 'Moscow',
    region: null,
    postalCode: null,
    country: 'RU',
  }],
});

const people = [maria, john, russ];

function ids(filters: Partial<AdvancedSearchFilters>): string[] {
  return filterAdvancedSearch(people, { ...emptyFilters, ...filters }).map((r) => r.id);
}

describe('advanced search', () => {
  describe('parseAdvancedSearchFilters', () => {
    it('trims values and fills missing keys', () => {
      expect(parseAdvancedSearchFilters({ name: '  ana ', phone: ['123', '456'] })).toEqual({
        ...emptyFilters,
        name: 'ana',
        phone: '123',
      });
    });
  });

  describe('hasActiveFilters', () => {
    it('is false when every filter is empty', () => {
      expect(hasActiveFilters(emptyFilters)).toBe(false);
      expect(hasActiveFilters({ ...emptyFilters, email: 'x' })).toBe(true);
    });
  });

  describe('filterAdvancedSearch', () => {
    it('returns nothing when no filter is set', () => {
      expect(ids({})).toEqual([]);
    });

    it('matches names partially, ignoring case and accents', () => {
      expect(ids({ name: 'mari' })).toEqual(['maria']);
      expect(ids({ name: 'GARCIA' })).toEqual(['maria']);
      expect(ids({ name: 'majo' })).toEqual(['maria']);
      expect(ids({ name: 'maria garcia' })).toEqual(['maria']);
    });

    it('matches location by city, region, postal code, and country name or code', () => {
      expect(ids({ location: 'madr' })).toEqual(['maria']);
      expect(ids({ location: '28013' })).toEqual(['maria']);
      expect(ids({ location: 'germany' })).toEqual(['john']);
      expect(ids({ location: 'berlin germany' })).toEqual(['john']);
    });

    it('matches country codes exactly', () => {
      expect(ids({ location: 'ru' })).toEqual(['russ']);
      expect(ids({ location: 'ES' })).toEqual(['maria']);
    });

    it('matches email partially and case-insensitively', () => {
      expect(ids({ email: 'example.com' })).toEqual(['maria']);
      expect(ids({ email: 'GMAIL' })).toEqual(['john']);
    });

    it('matches phone numbers ignoring formatting', () => {
      expect(ids({ phone: '612345' })).toEqual(['maria']);
      expect(ids({ phone: '612 345 678' })).toEqual(['maria']);
      expect(ids({ phone: '030-555' })).toEqual(['john']);
      expect(ids({ phone: '999' })).toEqual([]);
    });

    it('requires every keyword to appear in notes, in any order', () => {
      expect(ids({ keywords: 'japanese climbing' })).toEqual(['maria']);
      expect(ids({ keywords: 'berlin' })).toEqual(['john']);
      expect(ids({ keywords: 'japanese berlin' })).toEqual([]);
    });

    it('combines filters with AND', () => {
      expect(ids({ name: 'john', location: 'berlin' })).toEqual(['john']);
      expect(ids({ name: 'john', location: 'madrid' })).toEqual([]);
    });

    it('returns contact details for display', () => {
      const [result] = filterAdvancedSearch([maria], { ...emptyFilters, name: 'maria' });
      expect(result.emails).toEqual(['Maria.Garcia@Example.com']);
      expect(result.phones).toEqual(['+34 612 345 678']);
      expect(result.locations).toEqual(['Madrid, Comunidad de Madrid, Spain']);
    });
  });

  describe('advancedSearchPeople', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('does not query the database without filters', async () => {
      const result = await advancedSearchPeople('user1', emptyFilters);
      expect(result).toEqual({ results: [], total: 0 });
      expect(mocks.personFindMany).not.toHaveBeenCalled();
    });

    it("only reads the user's non-deleted people", async () => {
      mocks.personFindMany.mockResolvedValue(people);
      const result = await advancedSearchPeople('user1', { ...emptyFilters, location: 'berlin' });
      expect(mocks.personFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user1', deletedAt: null } })
      );
      expect(result.total).toBe(1);
      expect(result.results[0].id).toBe('john');
    });
  });
});
