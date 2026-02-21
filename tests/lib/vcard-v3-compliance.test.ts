/**
 * Tests for vCard v3.0 (RFC 2426) compliance
 */

import { describe, it, expect } from 'vitest';
import { personToVCard } from '@/lib/vcard';
import type { PersonWithRelations } from '@/lib/carddav/types';

describe('vCard v3.0 Compliance (RFC 2426)', () => {
  const createTestPerson = (overrides = {}): PersonWithRelations => ({
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
    cardDavSyncEnabled: true,
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

  describe('Version and structure', () => {
    it('should use VERSION:3.0', () => {
      const person = createTestPerson();
      const vcard = personToVCard(person);

      expect(vcard).toContain('VERSION:3.0');
      expect(vcard).not.toContain('VERSION:4.0');
    });

    it('should have BEGIN:VCARD and END:VCARD', () => {
      const person = createTestPerson();
      const vcard = personToVCard(person);

      expect(vcard).toMatch(/^BEGIN:VCARD/);
      expect(vcard).toMatch(/END:VCARD$/);
    });

    it('should use CRLF line endings', () => {
      const person = createTestPerson();
      const vcard = personToVCard(person);

      // All line breaks should be \r\n
      expect(vcard).toContain('\r\n');

      // Should not have standalone \n (except in property values)
      const lines = vcard.split('\r\n');
      expect(lines.length).toBeGreaterThan(3);
    });
  });

  describe('Date formatting', () => {
    it('should format dates as YYYYMMDD', () => {
      const person = createTestPerson({
        importantDates: [
          {
            id: 'date-1',
            personId: 'test-1',
            title: 'Birthday',
            date: new Date('1990-05-15'),
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      });

      const vcard = personToVCard(person);

      expect(vcard).toContain('BDAY:19900515');
      expect(vcard).not.toContain('BDAY:1990-05-15'); // v4.0 format
    });

    it('should format year-unknown dates as --MMDD', () => {
      const person = createTestPerson({
        importantDates: [
          {
            id: 'date-1',
            personId: 'test-1',
            title: 'Birthday',
            date: new Date('1604-05-15T12:00:00Z'), // Year marker for unknown, use UTC
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      });

      const vcard = personToVCard(person);

      // Should format as --MMDD (year omitted)
      expect(vcard).toMatch(/BDAY:--05(14|15)/); // Allow for timezone variations
    });
  });

  describe('Phone number types', () => {
    it('should convert MOBILE to CELL for v3.0 compatibility', () => {
      const person = createTestPerson({
        phoneNumbers: [
          {
            id: 'phone-1',
            personId: 'test-1',
            type: 'mobile',
            number: '+1234567890',
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      });

      const vcard = personToVCard(person);

      expect(vcard).toContain('TEL;TYPE=CELL:+1234567890');
      expect(vcard).not.toContain('TEL;TYPE=MOBILE:');
    });

    it('should keep other phone types as-is', () => {
      const person = createTestPerson({
        phoneNumbers: [
          {
            id: 'phone-1',
            personId: 'test-1',
            type: 'work',
            number: '+1111111111',
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
          {
            id: 'phone-2',
            personId: 'test-1',
            type: 'home',
            number: '+2222222222',
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      });

      const vcard = personToVCard(person);

      expect(vcard).toContain('TEL;TYPE=WORK:+1111111111');
      expect(vcard).toContain('TEL;TYPE=HOME:+2222222222');
    });
  });

  describe('Special dates (X-ABDATE and X-ANNIVERSARY)', () => {
    it('should export both X-ABDATE and X-ANNIVERSARY for important dates', () => {
      const person = createTestPerson({
        importantDates: [
          {
            id: 'date-1',
            personId: 'test-1',
            title: 'Anniversary',
            date: new Date('2020-06-15'),
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      });

      const vcard = personToVCard(person);

      // Apple format
      expect(vcard).toContain('item1.X-ABDATE;VALUE=date-and-or-time:20200615');
      expect(vcard).toContain('item1.X-ABLabel:Anniversary');

      // Android format
      expect(vcard).toContain('X-ANNIVERSARY;TYPE=ANNIVERSARY:20200615');
    });

    it('should use item grouping for multiple important dates', () => {
      const person = createTestPerson({
        importantDates: [
          {
            id: 'date-1',
            personId: 'test-1',
            title: 'Anniversary',
            date: new Date('2020-06-15'),
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
          {
            id: 'date-2',
            personId: 'test-1',
            title: 'First Date',
            date: new Date('2019-01-20'),
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      });

      const vcard = personToVCard(person);

      // Should have item1 and item2
      expect(vcard).toContain('item1.X-ABDATE');
      expect(vcard).toContain('item2.X-ABDATE');
    });

    it('should not export Birthday as special date (uses BDAY instead)', () => {
      const person = createTestPerson({
        importantDates: [
          {
            id: 'date-1',
            personId: 'test-1',
            title: 'Birthday',
            date: new Date('1990-05-15'),
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      });

      const vcard = personToVCard(person);

      expect(vcard).toContain('BDAY:19900515');
      expect(vcard).not.toContain('X-ABDATE;VALUE=date-and-or-time:19900515');
      expect(vcard).not.toContain('X-ANNIVERSARY;TYPE=BIRTHDAY');
    });
  });

  describe('URL, IMPP, and GEO with item grouping', () => {
    it('should use item grouping for URLs with X-ABLabel', () => {
      const person = createTestPerson({
        urls: [
          {
            id: 'url-1',
            personId: 'test-1',
            type: 'Personal',
            url: 'https://example.com',
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      });

      const vcard = personToVCard(person);

      expect(vcard).toMatch(/item\d+\.URL:https:\/\/example\.com/);
      expect(vcard).toMatch(/item\d+\.X-ABLabel:Personal/);
    });

    it('should use item grouping for IMPP with X-ABLabel', () => {
      const person = createTestPerson({
        imHandles: [
          {
            id: 'im-1',
            personId: 'test-1',
            protocol: 'Skype',
            handle: 'johndoe',
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      });

      const vcard = personToVCard(person);

      expect(vcard).toMatch(/item\d+\.IMPP:skype:johndoe/);
      expect(vcard).toMatch(/item\d+\.X-ABLabel:Skype/);
    });

    it('should use item grouping for GEO with X-ABLabel', () => {
      const person = createTestPerson({
        locations: [
          {
            id: 'loc-1',
            personId: 'test-1',
            type: 'Home',
            latitude: 40.7128,
            longitude: -74.0060,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      });

      const vcard = personToVCard(person);

      expect(vcard).toMatch(/item\d+\.GEO:40\.7128;-74\.006/);
      expect(vcard).toMatch(/item\d+\.X-ABLabel:Home/);
    });
  });

  describe('Line folding', () => {
    it('should fold lines longer than 75 characters', () => {
      const longNote = 'A'.repeat(100); // Create very long note
      const person = createTestPerson({
        notes: longNote,
      });

      const vcard = personToVCard(person);

      // Should have line continuation (space at start of line)
      const lines = vcard.split('\r\n');
      const noteLines = lines.filter(line => line.includes('NOTE') || line.startsWith(' '));

      // Should have multiple lines for the note
      expect(noteLines.length).toBeGreaterThan(1);

      // Continuation lines should start with space
      const continuationLines = noteLines.filter(line => line.startsWith(' '));
      expect(continuationLines.length).toBeGreaterThan(0);
    });

    it('should not exceed 75 characters per line', () => {
      const person = createTestPerson({
        notes: 'A'.repeat(200),
        organization: 'Very Long Organization Name That Exceeds Seventy Five Characters Limit',
      });

      const vcard = personToVCard(person);
      const lines = vcard.split('\r\n');

      for (const line of lines) {
        // Each line should be 75 chars or less
        expect(line.length).toBeLessThanOrEqual(75);
      }
    });
  });

  describe('Character escaping', () => {
    it('should escape special characters in text fields', () => {
      const person = createTestPerson({
        notes: 'Line 1\nLine 2',
        organization: 'Company, Inc.',
      });

      const vcard = personToVCard(person);

      expect(vcard).toContain('NOTE:Line 1\\nLine 2');
      expect(vcard).toContain('ORG:Company\\, Inc.');
    });

    it('should escape backslashes', () => {
      const person = createTestPerson({
        notes: 'Path: C:\\Users\\John',
      });

      const vcard = personToVCard(person);

      expect(vcard).toContain('NOTE:Path: C:\\\\Users\\\\John');
    });

    it('should escape semicolons in structured fields', () => {
      const person = createTestPerson({
        surname: 'Doe;Smith', // Edge case
        organization: 'Company; Division',
      });

      const vcard = personToVCard(person);

      expect(vcard).toContain('Doe\\;Smith');
      expect(vcard).toContain('ORG:Company\\; Division');
    });
  });

  describe('Address formatting', () => {
    it('should format address with semicolons as field separators', () => {
      const person = createTestPerson({
        addresses: [
          {
            id: 'addr-1',
            personId: 'test-1',
            type: 'home',
            streetLine1: '123 Main St',
            streetLine2: 'Apt 4B',
            locality: 'New York',
            region: 'NY',
            postalCode: '10001',
            country: 'USA',
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      });

      const vcard = personToVCard(person);

      // ADR format: ;;street;locality;region;postal;country
      expect(vcard).toContain('ADR;TYPE=HOME:;;123 Main St\\nApt 4B;New York;NY;10001;USA');
    });

    it('should handle addresses with missing fields', () => {
      const person = createTestPerson({
        addresses: [
          {
            id: 'addr-1',
            personId: 'test-1',
            type: 'work',
            streetLine1: '456 Office Blvd',
            streetLine2: null,
            locality: 'Boston',
            region: null,
            postalCode: null,
            country: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      });

      const vcard = personToVCard(person);

      expect(vcard).toContain('ADR;TYPE=WORK:;;456 Office Blvd;Boston;;;');
    });
  });
});
