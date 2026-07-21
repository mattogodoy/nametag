import { describe, it, expect } from 'vitest';
import { buildAddressHash, hasGeocodableContent } from '../../lib/geocoding/hash';

const base = {
  streetLine1: '123 Main St',
  streetLine2: null,
  locality: 'Springfield',
  region: 'IL',
  postalCode: '62701',
  country: 'US',
};

describe('buildAddressHash', () => {
  it('returns a stable sha256 hex string', () => {
    const hash = buildAddressHash(base);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(buildAddressHash(base)).toBe(hash);
  });

  it('ignores case and extra whitespace', () => {
    const messy = { ...base, streetLine1: '  123  MAIN st ', locality: 'SPRINGFIELD' };
    expect(buildAddressHash(messy)).toBe(buildAddressHash(base));
  });

  it('treats null and empty string the same', () => {
    expect(buildAddressHash({ ...base, streetLine2: '' })).toBe(
      buildAddressHash({ ...base, streetLine2: null })
    );
  });

  it('changes when any field changes', () => {
    expect(buildAddressHash({ ...base, locality: 'Shelbyville' })).not.toBe(buildAddressHash(base));
  });

  it('ignores notes: two addresses differing only in notes produce the same hash', () => {
    const withNotes = { ...base, notes: 'This is where they work: Random Company' };
    const withDifferentNotes = { ...base, notes: 'A completely different note' };
    const withoutNotes = { ...base, notes: null };
    expect(buildAddressHash(withNotes)).toBe(buildAddressHash(withoutNotes));
    expect(buildAddressHash(withNotes)).toBe(buildAddressHash(withDifferentNotes));
    expect(buildAddressHash(withNotes)).toBe(buildAddressHash(base));
  });
});

describe('hasGeocodableContent', () => {
  it('is true when any field has content', () => {
    expect(hasGeocodableContent(base)).toBe(true);
    expect(hasGeocodableContent({ ...base, streetLine1: null, locality: null, region: null, postalCode: null, country: 'US' })).toBe(true);
  });

  it('is false when all fields are empty or whitespace', () => {
    expect(
      hasGeocodableContent({ streetLine1: null, streetLine2: '  ', locality: null, region: null, postalCode: null, country: null })
    ).toBe(false);
  });
});
