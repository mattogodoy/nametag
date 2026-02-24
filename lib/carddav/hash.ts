import crypto from 'crypto';

/**
 * Normalize a value for stable JSON serialization.
 * - Converts Date objects to ISO strings
 * - Converts Prisma Decimal types (objects with .toString()) to strings
 * - Recursively normalizes arrays and plain objects
 * - Sorts object keys for deterministic output
 */
function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'toFixed' in (value as Record<string, unknown>)) {
    // Prisma Decimal — has toFixed, toString, etc.
    return String(value);
  }
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = normalizeValue(obj[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Sort array items by a stable key for order-independent hashing.
 * Uses 'id' if available, otherwise falls back to 'value', 'number', 'email', 'url', 'handle', 'key'.
 */
function sortArray(arr: unknown[]): unknown[] {
  const stableKeys = ['id', 'value', 'number', 'email', 'url', 'handle', 'key'];
  return [...arr].sort((a, b) => {
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
      const aStr = JSON.stringify(a);
      const bStr = JSON.stringify(b);
      if (aStr === bStr) return 0;
      return aStr < bStr ? -1 : 1;
    }
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    for (const key of stableKeys) {
      if (key in aObj && key in bObj) {
        const aVal = String(aObj[key]);
        const bVal = String(bObj[key]);
        if (aVal === bVal) continue;
        return aVal < bVal ? -1 : 1;
      }
    }
    const aStr = JSON.stringify(a);
    const bStr = JSON.stringify(b);
    if (aStr === bStr) return 0;
    return aStr < bStr ? -1 : 1;
  });
}

/**
 * Build a consistent hash of person data for sync change detection.
 * All multi-value relations must be included for accurate comparison.
 *
 * Normalizes Dates to ISO strings, Decimals to strings, and sorts
 * arrays by stable keys to avoid order-dependent hash changes.
 */
export function buildLocalHash(person: {
  name?: string | null;
  surname?: string | null;
  middleName?: string | null;
  secondLastName?: string | null;
  prefix?: string | null;
  suffix?: string | null;
  nickname?: string | null;
  organization?: string | null;
  jobTitle?: string | null;
  gender?: string | null;
  anniversary?: Date | null;
  notes?: string | null;
  photo?: string | null;
  lastContact?: Date | null;
  phoneNumbers?: unknown[];
  emails?: unknown[];
  addresses?: unknown[];
  urls?: unknown[];
  imHandles?: unknown[];
  locations?: unknown[];
  customFields?: unknown[];
  importantDates?: unknown[];
}): string {
  const data = {
    name: person.name,
    surname: person.surname,
    middleName: person.middleName,
    secondLastName: person.secondLastName,
    prefix: person.prefix,
    suffix: person.suffix,
    nickname: person.nickname,
    organization: person.organization,
    jobTitle: person.jobTitle,
    gender: person.gender,
    anniversary: normalizeValue(person.anniversary),
    notes: person.notes,
    photo: person.photo,
    lastContact: normalizeValue(person.lastContact),
    phoneNumbers: sortArray((person.phoneNumbers || []).map(normalizeValue)),
    emails: sortArray((person.emails || []).map(normalizeValue)),
    addresses: sortArray((person.addresses || []).map(normalizeValue)),
    urls: sortArray((person.urls || []).map(normalizeValue)),
    imHandles: sortArray((person.imHandles || []).map(normalizeValue)),
    locations: sortArray((person.locations || []).map(normalizeValue)),
    customFields: sortArray((person.customFields || []).map(normalizeValue)),
    importantDates: sortArray((person.importantDates || []).map(normalizeValue)),
  };

  return crypto.createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}
