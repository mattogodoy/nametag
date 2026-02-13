/**
 * Unit tests for vCard transformation utilities
 */

import { describe, it, expect } from 'vitest';
import { personToVCard, vCardToPerson } from '@/lib/vcard';
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
      expect(vcard).toContain('VERSION:3.0');
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
            createdAt: new Date(),
          },
        ],
        emails: [
          {
            id: 'email-1',
            personId: 'test-1',
            type: 'work',
            email: 'john@example.com',
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

      expect(vcard).toContain('TEL;TYPE=CELL:+1234567890'); // v3.0 uses CELL instead of MOBILE
      expect(vcard).toContain('EMAIL;TYPE=WORK:john@example.com');
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

      expect(vcard).toContain('BDAY:19900515'); // v3.0 format (YYYYMMDD)
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
VERSION:3.0
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
VERSION:3.0
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
VERSION:3.0
UID:test-uid
FN:John Doe
N:Doe;John;;;
TEL;TYPE=mobile:+1234567890
EMAIL;TYPE=work:john@example.com
END:VCARD`;

      const person = vCardToPerson(vcard);

      expect(person.phoneNumbers).toHaveLength(1);
      expect(person.phoneNumbers[0].type).toBe('mobile');
      expect(person.phoneNumbers[0].number).toBe('+1234567890');

      expect(person.emails).toHaveLength(1);
      expect(person.emails[0].type).toBe('work');
      expect(person.emails[0].email).toBe('john@example.com');
    });

    it('should parse professional information', () => {
      const vcard = `BEGIN:VCARD
VERSION:3.0
UID:test-uid
FN:John Doe
N:Doe;John;;;
ORG:Acme Corp
TITLE:Software Engineer
END:VCARD`;

      const person = vCardToPerson(vcard);

      expect(person.organization).toBe('Acme Corp');
      expect(person.jobTitle).toBe('Software Engineer');
    });

    it('should parse birthday', () => {
      const vcard = `BEGIN:VCARD
VERSION:3.0
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
VERSION:3.0
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
VERSION:3.0
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

  describe('IMPP export - Apple compatibility', () => {
    function makePersonWithIM(imHandles: { protocol: string; handle: string }[]): PersonWithRelations {
      return {
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
        imHandles: imHandles.map((im, i) => ({
          id: `im-${i}`,
          personId: 'test-1',
          protocol: im.protocol,
          handle: im.handle,
          createdAt: new Date(),
        })),
        locations: [],
        customFields: [],
        importantDates: [],
        relationshipsFrom: [],
        groups: [],
      };
    }

    it('should export standard protocols with native URI scheme', () => {
      const person = makePersonWithIM([
        { protocol: 'xmpp', handle: 'john@jabber.org' },
        { protocol: 'sip', handle: 'john@sip.example.com' },
        { protocol: 'irc', handle: 'johndoe' },
        { protocol: 'skype', handle: 'john.doe' },
      ]);

      const vcard = personToVCard(person);

      expect(vcard).toContain('IMPP:xmpp:john@jabber.org');
      expect(vcard).toContain('IMPP:sip:john@sip.example.com');
      expect(vcard).toContain('IMPP:irc:johndoe');
      expect(vcard).toContain('IMPP:skype:john.doe');
      // Standard protocols should NOT use x-apple: scheme
      expect(vcard).not.toContain('x-apple:john@jabber.org');
    });

    it('should export non-standard protocols with x-apple: scheme and X-SERVICE-TYPE', () => {
      const person = makePersonWithIM([
        { protocol: 'telegram', handle: 'johndoe' },
        { protocol: 'slack', handle: 'john.doe' },
        { protocol: 'signal', handle: '+1234567890' },
        { protocol: 'whatsapp', handle: '+1234567890' },
      ]);

      const vcard = personToVCard(person);

      expect(vcard).toContain('IMPP;X-SERVICE-TYPE=Telegram:x-apple:johndoe');
      expect(vcard).toContain('X-ABLabel:Telegram');
      expect(vcard).toContain('IMPP;X-SERVICE-TYPE=Slack:x-apple:john.doe');
      expect(vcard).toContain('X-ABLabel:Slack');
      expect(vcard).toContain('IMPP;X-SERVICE-TYPE=Signal:x-apple:+1234567890');
      expect(vcard).toContain('X-ABLabel:Signal');
      expect(vcard).toContain('IMPP;X-SERVICE-TYPE=Whatsapp:x-apple:+1234567890');
      expect(vcard).toContain('X-ABLabel:Whatsapp');
    });

    it('should capitalize the first letter of the service type', () => {
      const person = makePersonWithIM([
        { protocol: 'Telegram', handle: 'johndoe' },
      ]);

      const vcard = personToVCard(person);

      // Regardless of input casing, output should be capitalized consistently
      expect(vcard).toContain('X-SERVICE-TYPE=Telegram');
      expect(vcard).toContain('X-ABLabel:Telegram');
    });

    it('should round-trip Apple IMPP format: parse → export → parse preserves protocol and handle', () => {
      // Simulate an Apple-generated vCard with Telegram IM
      const appleVCard = `BEGIN:VCARD
VERSION:3.0
UID:apple-test-uid
FN:Doc Emmet
N:Emmet;Doc;;;
item1.IMPP;X-SERVICE-TYPE=Telegram:x-apple:docemmet
item1.X-ABLabel:Telegram
item2.IMPP;X-SERVICE-TYPE=Slack:x-apple:doc.emmet
item2.X-ABLabel:Slack
item3.IMPP:xmpp:doc@jabber.org
item3.X-ABLabel:xmpp
END:VCARD`;

      // Step 1: Parse Apple vCard
      const parsed = vCardToPerson(appleVCard);

      expect(parsed.imHandles).toHaveLength(3);

      // Telegram should be parsed correctly
      const telegram = parsed.imHandles.find(im => im.protocol === 'telegram');
      expect(telegram).toBeDefined();
      expect(telegram!.handle).toBe('docemmet');

      // Slack should be parsed correctly
      const slack = parsed.imHandles.find(im => im.protocol === 'slack');
      expect(slack).toBeDefined();
      expect(slack!.handle).toBe('doc.emmet');

      // XMPP should be parsed correctly
      const xmpp = parsed.imHandles.find(im => im.protocol === 'xmpp');
      expect(xmpp).toBeDefined();
      expect(xmpp!.handle).toBe('doc@jabber.org');

      // Step 2: Re-export as vCard
      const reExported = personToVCard({
        id: 'test-1',
        userId: 'user-1',
        name: parsed.name,
        surname: parsed.surname || null,
        middleName: parsed.middleName || null,
        secondLastName: null,
        nickname: parsed.nickname || null,
        prefix: parsed.prefix || null,
        suffix: parsed.suffix || null,
        uid: parsed.uid || null,
        organization: parsed.organization || null,
        jobTitle: parsed.jobTitle || null,
        photo: parsed.photo || null,
        gender: parsed.gender || null,
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
        imHandles: parsed.imHandles.map((im, i) => ({
          id: `im-${i}`,
          personId: 'test-1',
          protocol: im.protocol,
          handle: im.handle,
          createdAt: new Date(),
        })),
        locations: [],
        customFields: [],
        importantDates: [],
        relationshipsFrom: [],
        groups: [],
      });

      // Step 3: Verify Apple-compatible format in re-exported vCard
      // Telegram and Slack should use x-apple: scheme with X-SERVICE-TYPE
      expect(reExported).toContain('IMPP;X-SERVICE-TYPE=Telegram:x-apple:docemmet');
      expect(reExported).toContain('IMPP;X-SERVICE-TYPE=Slack:x-apple:doc.emmet');
      // XMPP should use native URI scheme
      expect(reExported).toContain('IMPP:xmpp:doc@jabber.org');

      // Step 4: Parse the re-exported vCard to verify data integrity
      const reParsed = vCardToPerson(reExported);

      const reTelegram = reParsed.imHandles.find(im => im.protocol === 'telegram');
      expect(reTelegram).toBeDefined();
      expect(reTelegram!.handle).toBe('docemmet');

      const reSlack = reParsed.imHandles.find(im => im.protocol === 'slack');
      expect(reSlack).toBeDefined();
      expect(reSlack!.handle).toBe('doc.emmet');

      const reXmpp = reParsed.imHandles.find(im => im.protocol === 'xmpp');
      expect(reXmpp).toBeDefined();
      expect(reXmpp!.handle).toBe('doc@jabber.org');
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
            createdAt: new Date(),
          },
        ],
        emails: [
          {
            id: 'email-1',
            personId: 'test-1',
            type: 'work',
            email: 'john@example.com',
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
      expect(parsed.photo).toBe(original.photo);
      expect(parsed.gender).toBe(original.gender);
      expect(parsed.notes).toBe(original.notes);
      expect(parsed.phoneNumbers).toHaveLength(1);
      expect(parsed.emails).toHaveLength(1);
    });
  });
});
