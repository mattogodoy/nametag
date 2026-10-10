import { prisma } from '@/lib/prisma';
import { normalizeForSearch } from '@/lib/search';
import { getCountryName } from '@/lib/countries';

/**
 * Field-specific contact search used by the /search page.
 *
 * Every filter is optional. Filters that are set must all match (AND).
 * Matching is case- and accent-insensitive and accepts partial values,
 * so "mad" finds "Madrid" and "gmail" finds "ana@gmail.com".
 */
export interface AdvancedSearchFilters {
  name: string;
  location: string;
  email: string;
  phone: string;
  keywords: string;
}

export const ADVANCED_SEARCH_FILTER_KEYS = ['name', 'location', 'email', 'phone', 'keywords'] as const;

export const ADVANCED_SEARCH_MAX_RESULTS = 200;

export interface AdvancedSearchCandidate {
  id: string;
  name: string;
  surname: string | null;
  middleName: string | null;
  secondLastName: string | null;
  nickname: string | null;
  displayNameOverride: string | null;
  notes: string | null;
  photo: string | null;
  emails: { email: string }[];
  phoneNumbers: { number: string }[];
  addresses: {
    streetLine1: string | null;
    streetLine2: string | null;
    locality: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
  }[];
}

export interface AdvancedSearchResult {
  id: string;
  name: string;
  surname: string | null;
  middleName: string | null;
  secondLastName: string | null;
  nickname: string | null;
  displayNameOverride: string | null;
  photo: string | null;
  emails: string[];
  phones: string[];
  locations: string[];
}

/** Read filters from URL search params, trimming whitespace. */
export function parseAdvancedSearchFilters(
  params: Record<string, string | string[] | undefined>
): AdvancedSearchFilters {
  const read = (key: string): string => {
    const value = params[key];
    const first = Array.isArray(value) ? value[0] : value;
    return (first ?? '').trim();
  };
  return {
    name: read('name'),
    location: read('location'),
    email: read('email'),
    phone: read('phone'),
    keywords: read('keywords'),
  };
}

export function hasActiveFilters(filters: AdvancedSearchFilters): boolean {
  return ADVANCED_SEARCH_FILTER_KEYS.some((key) => filters[key].length > 0);
}

function includesNormalized(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false;
  return normalizeForSearch(haystack).includes(needle);
}

function matchesName(person: AdvancedSearchCandidate, query: string): boolean {
  const q = normalizeForSearch(query);
  const fields = [
    person.name,
    person.middleName,
    person.surname,
    person.secondLastName,
    person.nickname,
    person.displayNameOverride,
  ];
  if (fields.some((field) => includesNormalized(field, q))) return true;
  // Queries spanning several name parts, e.g. "ana garcia"
  const joined = normalizeForSearch(fields.filter(Boolean).join(' '));
  return joined.includes(q);
}

function matchesLocation(person: AdvancedSearchCandidate, query: string): boolean {
  const q = normalizeForSearch(query);
  return person.addresses.some((address) => {
    const countryName = getCountryName(address.country);
    const parts = [
      address.streetLine1,
      address.streetLine2,
      address.locality,
      address.region,
      address.postalCode,
      countryName,
    ];
    if (parts.some((part) => includesNormalized(part, q))) return true;
    // Country codes only match exactly, so "us" does not hit every address in "Russia"
    if (address.country && normalizeForSearch(address.country) === q) return true;
    // Queries spanning several parts, e.g. "berlin germany"
    return normalizeForSearch(parts.filter(Boolean).join(' ')).includes(q);
  });
}

function matchesEmail(person: AdvancedSearchCandidate, query: string): boolean {
  const q = normalizeForSearch(query);
  return person.emails.some((e) => includesNormalized(e.email, q));
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function matchesPhone(person: AdvancedSearchCandidate, query: string): boolean {
  const queryDigits = digitsOnly(query);
  const q = normalizeForSearch(query);
  return person.phoneNumbers.some((p) => {
    // Ignore formatting so "612345" finds "+34 612 345 678"
    if (queryDigits.length > 0 && digitsOnly(p.number).includes(queryDigits)) return true;
    return includesNormalized(p.number, q);
  });
}

function matchesKeywords(person: AdvancedSearchCandidate, query: string): boolean {
  if (!person.notes) return false;
  const notes = normalizeForSearch(person.notes);
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  return words.every((word) => notes.includes(word));
}

function formatAddress(address: AdvancedSearchCandidate['addresses'][number]): string {
  return [address.locality, address.region, getCountryName(address.country)]
    .filter(Boolean)
    .join(', ');
}

/** Pure filter step, separated from the database read so it can be unit tested. */
export function filterAdvancedSearch(
  people: AdvancedSearchCandidate[],
  filters: AdvancedSearchFilters
): AdvancedSearchResult[] {
  if (!hasActiveFilters(filters)) return [];

  return people
    .filter((person) => {
      if (filters.name && !matchesName(person, filters.name)) return false;
      if (filters.location && !matchesLocation(person, filters.location)) return false;
      if (filters.email && !matchesEmail(person, filters.email)) return false;
      if (filters.phone && !matchesPhone(person, filters.phone)) return false;
      if (filters.keywords && !matchesKeywords(person, filters.keywords)) return false;
      return true;
    })
    .map((person) => ({
      id: person.id,
      name: person.name,
      surname: person.surname,
      middleName: person.middleName,
      secondLastName: person.secondLastName,
      nickname: person.nickname,
      displayNameOverride: person.displayNameOverride,
      photo: person.photo,
      emails: person.emails.map((e) => e.email),
      phones: person.phoneNumbers.map((p) => p.number),
      locations: person.addresses.map(formatAddress).filter((loc) => loc.length > 0),
    }));
}

/**
 * Load the user's contacts and apply the filters in JS. Like /api/people/search,
 * this keeps matching accent-insensitive without PostgreSQL extensions.
 */
export async function advancedSearchPeople(
  userId: string,
  filters: AdvancedSearchFilters
): Promise<{ results: AdvancedSearchResult[]; total: number }> {
  if (!hasActiveFilters(filters)) return { results: [], total: 0 };

  const people = await prisma.person.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      surname: true,
      middleName: true,
      secondLastName: true,
      nickname: true,
      displayNameOverride: true,
      notes: true,
      photo: true,
      emails: { select: { email: true } },
      phoneNumbers: { select: { number: true } },
      addresses: {
        select: {
          streetLine1: true,
          streetLine2: true,
          locality: true,
          region: true,
          postalCode: true,
          country: true,
        },
      },
    },
    orderBy: [{ name: 'asc' }, { surname: 'asc' }],
  });

  const matches = filterAdvancedSearch(people, filters);
  return { results: matches.slice(0, ADVANCED_SEARCH_MAX_RESULTS), total: matches.length };
}
