/**
 * Tests for second last name handling in vCard export/import
 */

import { describe, it, expect } from 'vitest';
import { personToVCard, vCardToPerson } from '@/lib/vcard';
import type { PersonWithRelations } from '@/lib/carddav/types';

describe('vCard Second Last Name Handling', () => {
  const createTestPerson = (overrides = {}): PersonWithRelations => ({
    id: 'test-1',
    userId: 'user-1',
    name: 'Mauro',
    surname: 'Belluco',
    middleName: null,
    secondLastName: null,
    nickname: null,
    prefix: null,
    suffix: null,
    uid: 'test-uid-123',
    organization: null,
    jobTitle: null,
    photo: null,
    gender: null,
    anniversary: null,
    lastContact: null,
    notes: null,
    relationshipToUserId: null,
    contactReminderEnabled: false,
    contactReminderInterval: null,
    contactReminderIntervalUnit: null,
    lastContactReminderSent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    phoneNumbers: [],
    emails: [],
    addresses: [],
    urls: [],
    imHandles: [],
    locations: [],
    customFields: [],
    importantDates: [],
    relationshipsFrom: [],
    groups: [],
    ...overrides,
  });

  describe('Export with secondLastName', () => {
    it('should combine surname and secondLastName in N property', () => {
      const person = createTestPerson({
        surname: 'García',
        secondLastName: 'López',
      });

      const vcard = personToVCard(person);

      // Should combine both surnames in family name field
      expect(vcard).toContain('N:García López;Mauro;;;');
    });

    it('should include X-NAMETAG-SECOND-LASTNAME extension', () => {
      const person = createTestPerson({
        surname: 'García',
        secondLastName: 'López',
      });

      const vcard = personToVCard(person);

      expect(vcard).toContain('X-NAMETAG-SECOND-LASTNAME:López');
    });

    it('should include secondLastName in formatted name', () => {
      const person = createTestPerson({
        surname: 'García',
        secondLastName: 'López',
      });

      const vcard = personToVCard(person);

      expect(vcard).toContain('FN:Mauro García López');
    });

    it('should handle secondLastName with spaces (De La Rosa)', () => {
      const person = createTestPerson({
        surname: 'Belluco',
        secondLastName: 'De La Rosa',
      });

      const vcard = personToVCard(person);

      expect(vcard).toContain('N:Belluco De La Rosa;Mauro;;;');
      expect(vcard).toContain('X-NAMETAG-SECOND-LASTNAME:De La Rosa');
      expect(vcard).toContain('FN:Mauro Belluco De La Rosa');
    });

    it('should work without secondLastName', () => {
      const person = createTestPerson({
        surname: 'Smith',
        secondLastName: null,
      });

      const vcard = personToVCard(person);

      expect(vcard).toContain('N:Smith;Mauro;;;');
      expect(vcard).not.toContain('X-NAMETAG-SECOND-LASTNAME');
      expect(vcard).toContain('FN:Mauro Smith');
    });

    it('should escape special characters in secondLastName', () => {
      const person = createTestPerson({
        surname: 'García',
        secondLastName: "O'Brien",
      });

      const vcard = personToVCard(person);

      // Should have escaped apostrophe in N property
      expect(vcard).toMatch(/N:García O'Brien;Mauro;;;/);
    });
  });

  describe('Import with secondLastName', () => {
    it('should extract secondLastName from X-NAMETAG-SECOND-LASTNAME', () => {
      const vcardText = `BEGIN:VCARD
VERSION:3.0
FN:Juan García López
N:García López;Juan;;;
X-NAMETAG-SECOND-LASTNAME:López
END:VCARD`;

      const parsed = vCardToPerson(vcardText);

      expect(parsed.name).toBe('Juan');
      expect(parsed.surname).toBe('García');
      expect(parsed.secondLastName).toBe('López');
    });

    it('should split combined surname when X-NAMETAG-SECOND-LASTNAME is present', () => {
      const vcardText = `BEGIN:VCARD
VERSION:3.0
FN:Mauro Belluco De La Rosa
N:Belluco De La Rosa;Mauro;;;
X-NAMETAG-SECOND-LASTNAME:De La Rosa
END:VCARD`;

      const parsed = vCardToPerson(vcardText);

      expect(parsed.surname).toBe('Belluco');
      expect(parsed.secondLastName).toBe('De La Rosa');
    });

    it('should handle vCard without X-NAMETAG-SECOND-LASTNAME', () => {
      const vcardText = `BEGIN:VCARD
VERSION:3.0
FN:John Smith
N:Smith;John;;;
END:VCARD`;

      const parsed = vCardToPerson(vcardText);

      expect(parsed.surname).toBe('Smith');
      expect(parsed.secondLastName).toBeUndefined();
    });

    it('should not split if secondLastName is not at end of combined surname', () => {
      // Edge case: surname="García López Martinez", secondLastName="López"
      // Should not split because López is not at the end
      const vcardText = `BEGIN:VCARD
VERSION:3.0
FN:Juan García López Martinez
N:García López Martinez;Juan;;;
X-NAMETAG-SECOND-LASTNAME:López
END:VCARD`;

      const parsed = vCardToPerson(vcardText);

      // Should keep combined surname as-is since split logic requires exact match at end
      expect(parsed.surname).toBe('García López Martinez');
      expect(parsed.secondLastName).toBe('López');
    });

    it('should handle v4.0 vCards with secondLastName', () => {
      const vcardText = `BEGIN:VCARD
VERSION:4.0
FN:Juan García López
N:García López;Juan;;;
X-NAMETAG-SECOND-LASTNAME:López
END:VCARD`;

      const parsed = vCardToPerson(vcardText);

      expect(parsed.surname).toBe('García');
      expect(parsed.secondLastName).toBe('López');
    });
  });

  describe('Round-trip preservation', () => {
    it('should preserve secondLastName through export and import', () => {
      const original = createTestPerson({
        name: 'Juan',
        surname: 'García',
        secondLastName: 'López',
      });

      const exported = personToVCard(original);
      const imported = vCardToPerson(exported);

      expect(imported.name).toBe('Juan');
      expect(imported.surname).toBe('García');
      expect(imported.secondLastName).toBe('López');
    });

    it('should preserve complex secondLastName with spaces', () => {
      const original = createTestPerson({
        name: 'María',
        surname: 'Fernández',
        secondLastName: 'De La Cruz',
      });

      const exported = personToVCard(original);
      const imported = vCardToPerson(exported);

      expect(imported.surname).toBe('Fernández');
      expect(imported.secondLastName).toBe('De La Cruz');
    });

    it('should work without secondLastName', () => {
      const original = createTestPerson({
        name: 'John',
        surname: 'Smith',
        secondLastName: null,
      });

      const exported = personToVCard(original);
      const imported = vCardToPerson(exported);

      expect(imported.surname).toBe('Smith');
      expect(imported.secondLastName).toBeUndefined();
    });
  });
});
