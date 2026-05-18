import { describe, it, expect } from 'vitest';
import { buildScalarPersonData } from '@/lib/carddav/vcard-import';
import type { ParsedVCardData } from '@/lib/carddav/types';

function buildParsedData(overrides: Partial<ParsedVCardData> = {}): ParsedVCardData {
  return {
    name: 'Mom',
    surname: 'Gonzalez',
    middleName: undefined,
    secondLastName: undefined,
    prefix: undefined,
    suffix: undefined,
    nickname: 'Mom',
    uid: 'test-uid',
    organization: 'Acme Corp',
    jobTitle: 'CEO',
    photo: undefined,
    gender: undefined,
    notes: 'Some notes',
    anniversary: undefined,
    lastContact: undefined,
    phoneNumbers: [],
    emails: [],
    addresses: [],
    urls: [],
    imHandles: [],
    locations: [],
    customFields: [],
    importantDates: [],
    categories: [],
    ...overrides,
  };
}

describe('buildScalarPersonData photo handling', () => {
  it('should return undefined for photo when vCard has no PHOTO field', () => {
    const data = buildParsedData({ photo: undefined });
    const result = buildScalarPersonData(data);

    expect(result.photo).toBeUndefined();
  });

  it('should return the photo data URI when vCard has a PHOTO field', () => {
    const data = buildParsedData({ photo: 'data:image/jpeg;base64,abc123' });
    const result = buildScalarPersonData(data);

    expect(result.photo).toBe('data:image/jpeg;base64,abc123');
  });
});

describe('buildScalarPersonData with skipNameFields', () => {
  it('should return all fields when skipNameFields is false', () => {
    const data = buildParsedData();
    const result = buildScalarPersonData(data, false);

    expect(result.name).toBe('Mom');
    expect(result.surname).toBe('Gonzalez');
    expect(result.organization).toBe('Acme Corp');
    expect(result.notes).toBe('Some notes');
  });

  it('should return all fields when skipNameFields is not provided', () => {
    const data = buildParsedData();
    const result = buildScalarPersonData(data);

    expect(result.name).toBe('Mom');
    expect(result.surname).toBe('Gonzalez');
  });

  it('should skip name fields when skipNameFields is true', () => {
    const data = buildParsedData();
    const result = buildScalarPersonData(data, true);

    expect(result.name).toBeUndefined();
    expect(result.surname).toBeUndefined();
    expect(result.middleName).toBeUndefined();
    expect(result.secondLastName).toBeUndefined();
    expect(result.prefix).toBeUndefined();
    expect(result.suffix).toBeUndefined();
  });

  it('should still return non-name fields when skipNameFields is true', () => {
    const data = buildParsedData();
    const result = buildScalarPersonData(data, true);

    expect(result.nickname).toBe('Mom');
    expect(result.organization).toBe('Acme Corp');
    expect(result.jobTitle).toBe('CEO');
    expect(result.notes).toBe('Some notes');
  });

  it('should skip all six name components when skipNameFields is true', () => {
    const data = buildParsedData({
      name: 'Mom',
      surname: 'Gonzalez',
      middleName: 'Elena',
      secondLastName: 'Lopez',
      prefix: 'Dr.',
      suffix: 'Jr.',
    });
    const result = buildScalarPersonData(data, true);

    expect(result.name).toBeUndefined();
    expect(result.surname).toBeUndefined();
    expect(result.middleName).toBeUndefined();
    expect(result.secondLastName).toBeUndefined();
    expect(result.prefix).toBeUndefined();
    expect(result.suffix).toBeUndefined();
    // Non-name fields still present
    expect(result.nickname).toBe('Mom');
  });
});
