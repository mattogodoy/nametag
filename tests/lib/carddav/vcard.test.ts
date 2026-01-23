/**
 * Unit tests for vCard transformation utilities
 */

import { describe, it, expect } from 'vitest';
import { personToVCard, vCardToPerson } from '@/lib/carddav/vcard';
import type { PersonWithRelations } from '@/lib/carddav/types';

describe('vCard Transformation', () => {
  describe('personToVCard', () => {
    it('should create minimal vCard with required fields', () => {
      const person: PersonWithRelations = {
        id: 'test-1',
        userId: 'user-1',
        name: 'John',
        surname: 'Doe',
        middleName: null,
        secondLastName: null,
        nickname: null,
        prefix: null,
        suffix: null,
        uid: 'test-uid-123',
        organization: null,
        jobTitle: null,
        role: null,
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
      };

      const vcard = personToVCard(person);

      expect(vcard).toContain('BEGIN:VCARD');
      expect(vcard).toContain('VERSION:4.0');
      expect(vcard).toContain('UID:test-uid-123');
      expect(vcard).toContain('FN:John Doe');
      expect(vcard).toContain('N:Doe;John;;;');
      expect(vcard).toContain('END:VCARD');
    });

    it('should include all name fields', () => {
      const person: PersonWithRelations = {
        id: 'test-1',
        userId: 'user-1',
        name: 'John',
        surname: 'Doe',
        middleName: 'Michael',
        secondLastName: null,
        nickname: 'Johnny',
        prefix: 'Dr.',
        suffix: 'Jr.',
        uid: null,
        organization: null,
        jobTitle: null,
        role: null,
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
      };

      const vcard = personToVCard(person);

      expect(vcard).toContain('FN:Dr. John Michael Doe Jr.');
      expect(vcard).toContain('N:Doe;John;Michael;Dr.;Jr.');
      expect(vcard).toContain('NICKNAME:Johnny');
    });

    it('should include contact information', () => {
      const person: PersonWithRelations = {
        id: 'test-1',
        userId: 'user-1',
        name: 'John',
        surname: 'Doe',
        middleName: null,
        secondLastName: null,
        nickname: null,
        prefix: null,
        suffix: null,
        uid: 'test-uid',
        organization: null,
        jobTitle: null,
        role: null,
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
        phoneNumbers: [
          {
            id: 'phone-1',
            personId: 'test-1',
            type: 'mobile',
            number: '+1234567890',
            isPrimary: true,
            createdAt: new Date(),
          },
        ],
        emails: [
          {
            id: 'email-1',
            personId: 'test-1',
            type: 'work',
            email: 'john@example.com',
            isPrimary: true,
            createdAt: new Date(),
          },
        ],
        addresses: [],
        urls: [],
        imHandles: [],
        locations: [],
        customFields: [],
        importantDates: [],
        relationshipsFrom: [],
        groups: [],
      };

      const vcard = personToVCard(person);

      expect(vcard).toContain('TEL;TYPE=MOBILE;PREF=1:+1234567890');
      expect(vcard).toContain('EMAIL;TYPE=WORK;PREF=1:john@example.com');
    });

    it('should include professional information', () => {
      const person: PersonWithRelations = {
        id: 'test-1',
        userId: 'user-1',
        name: 'John',
        surname: 'Doe',
        middleName: null,
        secondLastName: null,
        nickname: null,
        prefix: null,
        suffix: null,
        uid: 'test-uid',
        organization: 'Acme Corp',
        jobTitle: 'Software Engineer',
        role: 'Developer',
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
      };

      const vcard = personToVCard(person);

      expect(vcard).toContain('ORG:Acme Corp');
      expect(vcard).toContain('TITLE:Software Engineer');
      expect(vcard).toContain('ROLE:Developer');
    });

    it('should include birthday from important dates', () => {
      const person: PersonWithRelations = {
        id: 'test-1',
        userId: 'user-1',
        name: 'John',
        surname: 'Doe',
        middleName: null,
        secondLastName: null,
        nickname: null,
        prefix: null,
        suffix: null,
        uid: 'test-uid',
        organization: null,
        jobTitle: null,
        role: null,
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
        importantDates: [
          {
            id: 'date-1',
            personId: 'test-1',
            title: 'Birthday',
            date: new Date('1990-05-15'),
            reminderEnabled: false,
            reminderType: null,
            reminderInterval: null,
            reminderIntervalUnit: null,
            lastReminderSent: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
        relationshipsFrom: [],
        groups: [],
      };

      const vcard = personToVCard(person);

      expect(vcard).toContain('BDAY:1990-05-15');
    });

    it('should include categories from groups', () => {
      const person: PersonWithRelations = {
        id: 'test-1',
        userId: 'user-1',
        name: 'John',
        surname: 'Doe',
        middleName: null,
        secondLastName: null,
        nickname: null,
        prefix: null,
        suffix: null,
        uid: 'test-uid',
        organization: null,
        jobTitle: null,
        role: null,
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
        groups: [
          {
            group: {
              id: 'group-1',
              userId: 'user-1',
              name: 'Family',
              description: null,
              color: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
            },
          },
          {
            group: {
              id: 'group-2',
              userId: 'user-1',
              name: 'Friends',
              description: null,
              color: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
            },
          },
        ],
      };

      const vcard = personToVCard(person);

      expect(vcard).toContain('CATEGORIES:Family,Friends');
    });
  });

  describe('vCardToPerson', () => {
    it('should parse minimal vCard', () => {
      const vcard = `BEGIN:VCARD
VERSION:4.0
UID:test-uid-123
FN:John Doe
N:Doe;John;;;
END:VCARD`;

      const person = vCardToPerson(vcard);

      expect(person.uid).toBe('test-uid-123');
      expect(person.name).toBe('John');
      expect(person.surname).toBe('Doe');
    });

    it('should parse all name fields', () => {
      const vcard = `BEGIN:VCARD
VERSION:4.0
UID:test-uid
FN:Dr. John Michael Doe Jr.
N:Doe;John;Michael;Dr.;Jr.
NICKNAME:Johnny
END:VCARD`;

      const person = vCardToPerson(vcard);

      expect(person.surname).toBe('Doe');
      expect(person.name).toBe('John');
      expect(person.middleName).toBe('Michael');
      expect(person.prefix).toBe('Dr.');
      expect(person.suffix).toBe('Jr.');
      expect(person.nickname).toBe('Johnny');
    });

    it('should parse contact information', () => {
      const vcard = `BEGIN:VCARD
VERSION:4.0
UID:test-uid
FN:John Doe
N:Doe;John;;;
TEL;TYPE=MOBILE;PREF=1:+1234567890
EMAIL;TYPE=WORK;PREF=1:john@example.com
END:VCARD`;

      const person = vCardToPerson(vcard);

      expect(person.phoneNumbers).toHaveLength(1);
      expect(person.phoneNumbers[0].type).toBe('mobile');
      expect(person.phoneNumbers[0].number).toBe('+1234567890');
      expect(person.phoneNumbers[0].isPrimary).toBe(true);

      expect(person.emails).toHaveLength(1);
      expect(person.emails[0].type).toBe('work');
      expect(person.emails[0].email).toBe('john@example.com');
      expect(person.emails[0].isPrimary).toBe(true);
    });

    it('should parse professional information', () => {
      const vcard = `BEGIN:VCARD
VERSION:4.0
UID:test-uid
FN:John Doe
N:Doe;John;;;
ORG:Acme Corp
TITLE:Software Engineer
ROLE:Developer
END:VCARD`;

      const person = vCardToPerson(vcard);

      expect(person.organization).toBe('Acme Corp');
      expect(person.jobTitle).toBe('Software Engineer');
      expect(person.role).toBe('Developer');
    });

    it('should parse birthday', () => {
      const vcard = `BEGIN:VCARD
VERSION:4.0
UID:test-uid
FN:John Doe
N:Doe;John;;;
BDAY:1990-05-15
END:VCARD`;

      const person = vCardToPerson(vcard);

      expect(person.importantDates).toHaveLength(1);
      expect(person.importantDates[0].title).toBe('Birthday');
      expect(person.importantDates[0].date.toISOString()).toContain('1990-05-15');
    });

    it('should parse categories', () => {
      const vcard = `BEGIN:VCARD
VERSION:4.0
UID:test-uid
FN:John Doe
N:Doe;John;;;
CATEGORIES:Family,Friends,Work
END:VCARD`;

      const person = vCardToPerson(vcard);

      expect(person.categories).toEqual(['Family', 'Friends', 'Work']);
    });

    it('should handle folded lines', () => {
      const vcard = `BEGIN:VCARD
VERSION:4.0
UID:test-uid
FN:John Doe
N:Doe;John;;;
NOTE:This is a very long note that spans multiple lines and needs to be
  folded according to vCard spec
END:VCARD`;

      const person = vCardToPerson(vcard);

      expect(person.notes).toBe(
        'This is a very long note that spans multiple lines and needs to be folded according to vCard spec'
      );
    });
  });

  describe('Round-trip transformation', () => {
    it('should preserve data through round-trip conversion', () => {
      const original: PersonWithRelations = {
        id: 'test-1',
        userId: 'user-1',
        name: 'John',
        surname: 'Doe',
        middleName: 'Michael',
        secondLastName: null,
        nickname: 'Johnny',
        prefix: 'Dr.',
        suffix: 'Jr.',
        uid: 'test-uid-123',
        organization: 'Acme Corp',
        jobTitle: 'Engineer',
        role: 'Developer',
        photo: 'https://example.com/photo.jpg',
        gender: 'M',
        anniversary: null,
        lastContact: null,
        notes: 'Test notes',
        relationshipToUserId: null,
        contactReminderEnabled: false,
        contactReminderInterval: null,
        contactReminderIntervalUnit: null,
        lastContactReminderSent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        phoneNumbers: [
          {
            id: 'phone-1',
            personId: 'test-1',
            type: 'mobile',
            number: '+1234567890',
            isPrimary: true,
            createdAt: new Date(),
          },
        ],
        emails: [
          {
            id: 'email-1',
            personId: 'test-1',
            type: 'work',
            email: 'john@example.com',
            isPrimary: true,
            createdAt: new Date(),
          },
        ],
        addresses: [],
        urls: [],
        imHandles: [],
        locations: [],
        customFields: [],
        importantDates: [],
        relationshipsFrom: [],
        groups: [],
      };

      const vcard = personToVCard(original);
      const parsed = vCardToPerson(vcard);

      expect(parsed.uid).toBe(original.uid);
      expect(parsed.name).toBe(original.name);
      expect(parsed.surname).toBe(original.surname);
      expect(parsed.middleName).toBe(original.middleName);
      expect(parsed.nickname).toBe(original.nickname);
      expect(parsed.prefix).toBe(original.prefix);
      expect(parsed.suffix).toBe(original.suffix);
      expect(parsed.organization).toBe(original.organization);
      expect(parsed.jobTitle).toBe(original.jobTitle);
      expect(parsed.role).toBe(original.role);
      expect(parsed.photo).toBe(original.photo);
      expect(parsed.gender).toBe(original.gender);
      expect(parsed.notes).toBe(original.notes);
      expect(parsed.phoneNumbers).toHaveLength(1);
      expect(parsed.emails).toHaveLength(1);
    });
  });
});
