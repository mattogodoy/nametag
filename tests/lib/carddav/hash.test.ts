import { describe, it, expect } from 'vitest';
import { buildLocalHash } from '../../../lib/carddav/hash';

const basePerson = {
  name: 'Ada',
  surname: 'Lovelace',
  addresses: [
    {
      id: 'addr-1',
      type: 'Work',
      streetLine1: '1 Analytical Engine Way',
      streetLine2: null,
      locality: 'London',
      region: null,
      postalCode: 'SW1A 1AA',
      country: 'GB',
      latitude: null,
      longitude: null,
      geocodedAt: null,
      geocodeStatus: null,
      geocodeHash: null,
    },
  ],
};

describe('buildLocalHash', () => {
  it('ignores address notes when computing the hash', () => {
    const withoutNotes = basePerson;
    const withNotes = {
      ...basePerson,
      addresses: [{ ...basePerson.addresses[0], notes: 'Works at Random Company' }],
    };
    const withDifferentNotes = {
      ...basePerson,
      addresses: [{ ...basePerson.addresses[0], notes: 'A different note entirely' }],
    };

    expect(buildLocalHash(withNotes)).toBe(buildLocalHash(withoutNotes));
    expect(buildLocalHash(withNotes)).toBe(buildLocalHash(withDifferentNotes));
  });

  it('still changes when a non-notes address field changes', () => {
    const changed = {
      ...basePerson,
      addresses: [{ ...basePerson.addresses[0], locality: 'Manchester' }],
    };
    expect(buildLocalHash(changed)).not.toBe(buildLocalHash(basePerson));
  });
});
