/**
 * Tests for enhanced vCard parser
 * Covers vCard 3.0, 4.0, and vendor-specific extensions
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import {
  parseVCard,
  detectVCardVersion,
  parseProperties,
  associateItemGroups,
} from '@/lib/carddav/vcard-parser';

describe('vCard Parser', () => {
  describe('detectVCardVersion', () => {
    it('should detect vCard 4.0', () => {
      const vCard = 'BEGIN:VCARD\nVERSION:4.0\nFN:Test\nEND:VCARD';
      expect(detectVCardVersion(vCard)).toBe('4.0');
    });

    it('should detect vCard 3.0', () => {
      const vCard = 'BEGIN:VCARD\nVERSION:3.0\nFN:Test\nEND:VCARD';
      expect(detectVCardVersion(vCard)).toBe('3.0');
    });

    it('should default to 3.0 for vCard 2.1', () => {
      const vCard = 'BEGIN:VCARD\nVERSION:2.1\nFN:Test\nEND:VCARD';
      expect(detectVCardVersion(vCard)).toBe('3.0');
    });

    it('should default to 3.0 when VERSION is missing', () => {
      const vCard = 'BEGIN:VCARD\nFN:Test\nEND:VCARD';
      expect(detectVCardVersion(vCard)).toBe('3.0');
    });
  });

  describe('parseProperties', () => {
    it('should parse basic properties', () => {
      const vCard = 'BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nEND:VCARD';
      const props = parseProperties(vCard, '4.0');

      expect(props).toHaveLength(1);
      expect(props[0].property).toBe('FN');
      expect(props[0].value).toBe('John Doe');
    });

    it('should parse properties with parameters', () => {
      const vCard = 'BEGIN:VCARD\nVERSION:4.0\nTEL;TYPE=work:123456\nEND:VCARD';
      const props = parseProperties(vCard, '4.0');

      expect(props[0].property).toBe('TEL');
      expect(props[0].params.TYPE).toBe('work');
      expect(props[0].value).toBe('123456');
    });

    it('should parse properties with group prefix', () => {
      const vCard = 'BEGIN:VCARD\nVERSION:3.0\nitem1.URL:example.com\nEND:VCARD';
      const props = parseProperties(vCard, '3.0');

      expect(props[0].property).toBe('URL');
      expect(props[0].group).toBe('item1');
      expect(props[0].value).toBe('example.com');
    });

    it('should unfold multi-line values', () => {
      const vCard = 'BEGIN:VCARD\nVERSION:4.0\nNOTE:This is a\n  long note\nEND:VCARD';
      const props = parseProperties(vCard, '4.0');

      expect(props[0].value).toBe('This is a long note');
    });

    it('should handle multi-value TYPE parameter (v3)', () => {
      const vCard = 'BEGIN:VCARD\nVERSION:3.0\nTEL;TYPE=HOME,VOICE:123\nEND:VCARD';
      const props = parseProperties(vCard, '3.0');

      expect(props[0].params.TYPE).toEqual(['home', 'voice']);
    });

    it('should handle quoted parameter values (v4)', () => {
      const vCard = 'BEGIN:VCARD\nVERSION:4.0\nTEL;TYPE="work,voice":123\nEND:VCARD';
      const props = parseProperties(vCard, '4.0');

      expect(props[0].params.TYPE).toEqual(['work', 'voice']);
    });

    it('should unescape \\n, \\;, \\, and \\\\ in values', () => {
      const vCard = 'BEGIN:VCARD\nVERSION:3.0\nNOTE:line1\\nline2 a\\;b c\\,d path\\\\here\nEND:VCARD';
      const props = parseProperties(vCard, '3.0');

      expect(props[0].value).toBe('line1\nline2 a;b c,d path\\here');
    });

    it('should unescape \\: (vCard 4.0 extension some tools emit)', () => {
      const vCard = 'BEGIN:VCARD\nVERSION:3.0\nX-TS:2025-10-31T06\\:54\\:04Z\nEND:VCARD';
      const props = parseProperties(vCard, '3.0');

      expect(props[0].value).toBe('2025-10-31T06:54:04Z');
    });

    it('should decode \\\\: as literal backslash + colon, not strip the backslash', () => {
      // `\\:` = escape-sequence \\ (literal backslash) then literal `:`.
      // A naive regex chain that runs `/\\\\/g → \\` last would corrupt this
      // by first consuming `\:` and turning it into `:`. Left-to-right scan
      // must preserve the backslash.
      const vCard = 'BEGIN:VCARD\nVERSION:3.0\nX-PATH:C\\\\:drive\nEND:VCARD';
      const props = parseProperties(vCard, '3.0');

      expect(props[0].value).toBe('C\\:drive');
    });
  });

  describe('associateItemGroups', () => {
    it('should group properties by item prefix', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
item1.URL:example.com
item1.X-ABLabel:HomePage
item2.URL:test.com
item2.X-ABLabel:Work
END:VCARD`;

      const props = parseProperties(vCard, '3.0');
      const groups = associateItemGroups(props);

      expect(groups.item1).toHaveLength(2);
      expect(groups.item2).toHaveLength(2);
      expect(groups.item1[0].property).toBe('URL');
      expect(groups.item1[1].property).toBe('X-ABLABEL');
    });

    it('should handle properties without groups', () => {
      const vCard = 'BEGIN:VCARD\nVERSION:4.0\nFN:Test\nEND:VCARD';
      const props = parseProperties(vCard, '4.0');
      const groups = associateItemGroups(props);

      expect(Object.keys(groups)).toHaveLength(0);
    });
  });

  describe('parseVCard - Basic Properties', () => {
    it('should parse FN and N properties', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
N:Doe;John;Michael;Dr.;Jr.
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.name).toBe('John');
      expect(parsed.surname).toBe('Doe');
      expect(parsed.middleName).toBe('Michael');
      expect(parsed.prefix).toBe('Dr.');
      expect(parsed.suffix).toBe('Jr.');
    });

    it('should use FN as fallback when N is missing', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.name).toBe('John Doe');
    });

    it('should parse NICKNAME', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
NICKNAME:Johnny
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.nickname).toBe('Johnny');
    });

    it('should parse UID', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
UID:12345-abcde
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.uid).toBe('12345-abcde');
    });

    it('should parse ORG and TITLE', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
ORG:ACME Corp;Engineering
TITLE:Senior Engineer
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.organization).toBe('ACME Corp');
      expect(parsed.jobTitle).toBe('Senior Engineer');
    });

    it('should parse GENDER', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
GENDER:M
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.gender).toBe('M');
    });

    it('should parse NOTE', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
NOTE:Important contact
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.notes).toBe('Important contact');
    });

    it('should parse CATEGORIES', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
CATEGORIES:Friends,Work
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.categories).toEqual(['Friends', 'Work']);
    });
  });

  describe('parseVCard - Multi-value Fields', () => {
    it('should parse phone numbers with types', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
TEL;TYPE=work:123456789
TEL;TYPE=home:987654321
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.phoneNumbers).toHaveLength(2);
      expect(parsed.phoneNumbers[0]).toEqual({ type: 'work', number: '123456789' });
      expect(parsed.phoneNumbers[1]).toEqual({ type: 'home', number: '987654321' });
    });

    it('should parse emails with types', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
EMAIL;TYPE=work:work@example.com
EMAIL;TYPE=home:home@example.com
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.emails).toHaveLength(2);
      expect(parsed.emails[0]).toEqual({ type: 'work', email: 'work@example.com' });
      expect(parsed.emails[1]).toEqual({ type: 'home', email: 'home@example.com' });
    });

    it('should filter out INTERNET type from emails', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
EMAIL;TYPE=INTERNET;TYPE=HOME:test@example.com
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.emails[0].type).toBe('home');
    });

    it('should parse addresses', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
ADR;TYPE=work:;;123 Main St;Springfield;IL;62701;USA
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.addresses).toHaveLength(1);
      expect(parsed.addresses[0]).toEqual({
        type: 'work',
        streetLine1: '123 Main St',
        streetLine2: undefined,
        locality: 'Springfield',
        region: 'IL',
        postalCode: '62701',
        country: 'USA',
      });
    });

    it('should parse URLs', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
URL;TYPE=work:https://example.com
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.urls).toHaveLength(1);
      expect(parsed.urls[0]).toEqual({ type: 'work', url: 'https://example.com' });
    });

    it('should parse IMPP handles', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
IMPP:im:skype:username
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.imHandles).toHaveLength(1);
      expect(parsed.imHandles[0]).toEqual({ protocol: 'im', handle: 'skype:username' });
    });

    it('should parse GEO locations', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
GEO;TYPE=work:geo:37.386013,-122.082932
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.locations).toHaveLength(1);
      expect(parsed.locations[0]).toEqual({
        type: 'work',
        latitude: 37.386013,
        longitude: -122.082932,
      });
    });
  });

  describe('parseVCard - Date Parsing', () => {
    it('should parse BDAY in ISO format', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
BDAY:1990-05-15
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.importantDates).toHaveLength(1);
      expect(parsed.importantDates[0].type).toBe('birthday');
      expect(parsed.importantDates[0].title).toBe('');
      expect(parsed.importantDates[0].date.getFullYear()).toBe(1990);
      expect(parsed.importantDates[0].date.getMonth()).toBe(4); // May (0-indexed)
      expect(parsed.importantDates[0].date.getDate()).toBe(15);
    });

    it('should parse BDAY with year-omitted (v4 format)', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
BDAY:--05-15
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.importantDates).toHaveLength(1);
      expect(parsed.importantDates[0].date.getFullYear()).toBe(1604); // Year unknown marker
      expect(parsed.importantDates[0].date.getMonth()).toBe(4);
      expect(parsed.importantDates[0].date.getDate()).toBe(15);
    });

    it('should parse BDAY with year-omitted (v3 format)', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
BDAY:--0515
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.importantDates).toHaveLength(1);
      expect(parsed.importantDates[0].date.getFullYear()).toBe(1604);
      expect(parsed.importantDates[0].date.getMonth()).toBe(4);
      expect(parsed.importantDates[0].date.getDate()).toBe(15);
    });

    it('should parse BDAY in compact format (v3)', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
BDAY:19900515
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.importantDates).toHaveLength(1);
      expect(parsed.importantDates[0].date.getFullYear()).toBe(1990);
    });

    it('should handle X-APPLE-OMIT-YEAR parameter', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
BDAY;X-APPLE-OMIT-YEAR=1604:1604-05-15
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.importantDates[0].date.getFullYear()).toBe(1604);
    });

    it('should parse ANNIVERSARY', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
ANNIVERSARY:2015-06-20
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.importantDates).toHaveLength(1);
      expect(parsed.importantDates[0].type).toBe('anniversary');
      expect(parsed.importantDates[0].title).toBe('');
    });

    it('should handle LAST-CONTACT type in ANNIVERSARY', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
ANNIVERSARY;TYPE=LAST-CONTACT:2023-12-25
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.lastContact).toBeDefined();
      expect(parsed.lastContact?.getFullYear()).toBe(2023);
    });
  });

  describe('parseVCard - Photo Handling', () => {
    it('should keep HTTP URLs as-is', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
PHOTO:https://example.com/photo.jpg
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.photo).toBe('https://example.com/photo.jpg');
    });

    it('should keep data URIs as-is', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
PHOTO:data:image/png;base64,iVBORw0KGgo=
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.photo).toBe('data:image/png;base64,iVBORw0KGgo=');
    });

    it('should convert base64 encoded photos to data URI', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
PHOTO;ENCODING=b;TYPE=JPEG:iVBORw0KGgo=
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.photo).toBe('data:image/jpeg;base64,iVBORw0KGgo=');
    });

    it('should handle BASE64 encoding parameter', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
PHOTO;ENCODING=BASE64;TYPE=PNG:abc123
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.photo).toBe('data:image/png;base64,abc123');
    });

    it('should remove whitespace from base64 data', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
PHOTO;ENCODING=b;TYPE=JPEG:iVBOR
 w0KGgo=
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.photo).toBe('data:image/jpeg;base64,iVBORw0KGgo=');
    });

    it('should default to image/jpeg for base64 without TYPE', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
PHOTO;ENCODING=b:abc123
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.photo).toBe('data:image/jpeg;base64,abc123');
    });
  });

  describe('parseVCard - Apple/Google Extensions', () => {
    it('should decode Apple X-ABLabel format', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
item1.URL:example.com
item1.X-ABLabel:_$!<HomePage>!$_
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.urls).toHaveLength(1);
      expect(parsed.urls[0].type).toBe('HomePage');
    });

    it('should handle custom X-ABLabel values', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
item1.URL:example.com
item1.X-ABLabel:Custom Label
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.urls[0].type).toBe('Custom Label');
    });

    it('should parse X-ABDATE with label', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
item1.X-ABDATE:20230615
item1.X-ABLabel:Anniversary
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.importantDates).toHaveLength(1);
      expect(parsed.importantDates[0].title).toBe('Anniversary');
      expect(parsed.importantDates[0].date.getFullYear()).toBe(2023);
    });

    it('should parse X-SOCIALPROFILE as IM handle', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
X-SOCIALPROFILE:http://twitter.com/username
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.imHandles).toHaveLength(1);
      expect(parsed.imHandles[0].protocol).toBe('twitter');
      expect(parsed.imHandles[0].handle).toBe('http://twitter.com/username');
    });

    it('should store X-ABRELATEDNAMES as custom field', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
item1.X-ABRELATEDNAMES:John Doe
item1.X-ABLabel:Father
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.customFields).toHaveLength(1);
      expect(parsed.customFields[0].key).toBe('X-ABRELATEDNAMES');
      expect(parsed.customFields[0].value).toBe('John Doe');
      expect(parsed.customFields[0].type).toBe('Father');
    });

    it('uses X-ABLabel as EMAIL type when present', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
item1.EMAIL:matt@example.com
item1.X-ABLabel:Personal
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.emails).toHaveLength(1);
      expect(parsed.emails[0].email).toBe('matt@example.com');
      expect(parsed.emails[0].type).toBe('Personal');
    });

    it('uses X-ABLabel as TEL type when present', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
item1.TEL:+15555551212
item1.X-ABLabel:School
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.phoneNumbers).toHaveLength(1);
      expect(parsed.phoneNumbers[0].number).toBe('+15555551212');
      expect(parsed.phoneNumbers[0].type).toBe('School');
    });

    it('uses X-ABLabel as ADR type when present, preserving structured value', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
item1.ADR:;;1 Beach Rd;Coast;ST;11111;US
item1.X-ABLabel:Summer
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.addresses).toHaveLength(1);
      expect(parsed.addresses[0].type).toBe('Summer');
      expect(parsed.addresses[0].streetLine1).toBe('1 Beach Rd');
      expect(parsed.addresses[0].locality).toBe('Coast');
      expect(parsed.addresses[0].postalCode).toBe('11111');
    });

    it('prefers X-ABLabel over TYPE parameter for EMAIL', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
item1.EMAIL;TYPE=INTERNET:matt@example.com
item1.X-ABLabel:Personal
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.emails[0].type).toBe('Personal');
    });
  });

  describe('parseVCard - Custom Fields', () => {
    it('should preserve X- properties as custom fields', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
X-CUSTOM-FIELD:Custom Value
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.customFields).toHaveLength(1);
      expect(parsed.customFields[0]).toEqual({
        key: 'X-CUSTOM-FIELD',
        value: 'Custom Value',
      });
    });

    it('should preserve standard fields as custom fields (ROLE, LANG, etc.)', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
ROLE:Tech Lead
LANG;PREF=1:en
TZ:-0500
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.customFields).toHaveLength(3);
      expect(parsed.customFields.find(f => f.key === 'ROLE')?.value).toBe('Tech Lead');
      expect(parsed.customFields.find(f => f.key === 'LANG')?.value).toBe('en');
      expect(parsed.customFields.find(f => f.key === 'TZ')?.value).toBe('-0500');
    });

    it('should NOT capture REV or PRODID (server-authored metadata)', () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Test
REV:2025-10-31T06:54:04Z
PRODID:-//Google Inc//Google Contacts//EN
ROLE:Tech Lead
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.customFields.find(f => f.key === 'REV')).toBeUndefined();
      expect(parsed.customFields.find(f => f.key === 'PRODID')).toBeUndefined();
      expect(parsed.unknownProperties.find(p => p.key === 'REV')).toBeUndefined();
      expect(parsed.unknownProperties.find(p => p.key === 'PRODID')).toBeUndefined();
      expect(parsed.customFields.find(f => f.key === 'ROLE')?.value).toBe('Tech Lead');
    });
  });

  describe('parseVCard - Unknown Properties', () => {
    it('should collect unknown properties', () => {
      const vCard = `BEGIN:VCARD
VERSION:4.0
FN:Test
UNKNOWN-PROP:Some value
END:VCARD`;

      const parsed = parseVCard(vCard);

      expect(parsed.unknownProperties).toHaveLength(1);
      expect(parsed.unknownProperties[0].key).toBe('UNKNOWN-PROP');
      expect(parsed.unknownProperties[0].value).toBe('Some value');
    });

    it('should NOT append unknown properties to notes', () => {
      const vCard = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'FN:Test User',
        'N:User;Test;;;',
        'CLASS:PUBLIC',
        'PROFILE:VCARD',
        'NOTE:My real notes',
        'END:VCARD',
      ].join('\n');

      const result = parseVCard(vCard);
      expect(result.notes).toBe('My real notes');
      expect(result.notes).not.toContain('Unknown vCard Properties');
      expect(result.unknownProperties).toHaveLength(2);
      expect(result.unknownProperties.map(p => p.key)).toContain('CLASS');
      expect(result.unknownProperties.map(p => p.key)).toContain('PROFILE');
    });

    it('should leave notes undefined when only unknown properties exist', () => {
      const vCard = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'FN:Test User',
        'N:User;Test;;;',
        'CLASS:PUBLIC',
        'END:VCARD',
      ].join('\n');

      const result = parseVCard(vCard);
      expect(result.notes).toBeUndefined();
      expect(result.unknownProperties).toHaveLength(1);
    });
  });

  describe('parseVCard - Real World vCards', () => {
    it('should parse Google vCard example', () => {
      const vCardText = readFileSync('tests/vcards/google-vcard-example.vcf', 'utf-8');
      const parsed = parseVCard(vCardText);

      expect(parsed.version).toBe('3.0');
      expect(parsed.name).toBe('Emmetiano');
      expect(parsed.surname).toBe('Brown');
      expect(parsed.nickname).toBe('Doc');
      expect(parsed.phoneNumbers).toHaveLength(3);
      expect(parsed.emails).toHaveLength(2);
      expect(parsed.addresses).toHaveLength(2);
      expect(parsed.urls).toHaveLength(2);
      expect(parsed.importantDates).toHaveLength(3);
      expect(parsed.categories).toEqual(['myContacts']);
      expect(parsed.photo?.startsWith('https://')).toBe(true);
    });

    it('should parse Apple vCard example with extensions', () => {
      const vCardText = readFileSync('tests/vcards/apple-vcard-example.vcf', 'utf-8');
      const parsed = parseVCard(vCardText);

      expect(parsed.version).toBe('3.0');
      expect(parsed.name).toBe('Emmetiano');
      expect(parsed.surname).toBe('Brown');
      expect(parsed.phoneNumbers).toHaveLength(3);
      expect(parsed.emails).toHaveLength(2);
      expect(parsed.urls).toHaveLength(2);
      expect(parsed.imHandles.length).toBeGreaterThan(0); // Has social profiles
      expect(parsed.photo?.startsWith('data:image/jpeg;base64,')).toBe(true); // Base64 encoded
    });

    it('should parse v4 vCard example', () => {
      const vCardText = readFileSync('tests/vcards/v4-contact.vcf', 'utf-8');
      const parsed = parseVCard(vCardText);

      expect(parsed.version).toBe('4.0');
      expect(parsed.name).toBe('Taylor');
      expect(parsed.surname).toBe('Example');
      expect(parsed.prefix).toBe('Dr.');
      expect(parsed.suffix).toBe('PhD');
      expect(parsed.phoneNumbers).toHaveLength(2);
      expect(parsed.emails).toHaveLength(2);
      expect(parsed.addresses).toHaveLength(2);
      expect(parsed.urls).toHaveLength(2);
      expect(parsed.imHandles).toHaveLength(2);
      expect(parsed.importantDates).toHaveLength(1);
      expect(parsed.customFields.length).toBeGreaterThan(0); // Has ROLE, LANG, etc.
    });

    it('should associate URL labels in Google vCard', () => {
      const vCardText = readFileSync('tests/vcards/google-vcard-example.vcf', 'utf-8');
      const parsed = parseVCard(vCardText);

      const homePageUrl = parsed.urls.find(u => u.type === 'HomePage');
      const hobbiesUrl = parsed.urls.find(u => u.type === 'Hobbies');

      expect(homePageUrl).toBeDefined();
      expect(hobbiesUrl).toBeDefined();
    });

    it('should parse dates with year-omitted in Google vCard', () => {
      const vCardText = readFileSync('tests/vcards/google-vcard-example.vcf', 'utf-8');
      const parsed = parseVCard(vCardText);

      const birthday = parsed.importantDates.find(d => d.type === 'birthday');
      expect(birthday?.title).toBe('');
      expect(birthday?.date.getFullYear()).toBe(1604); // Year unknown
    });
  });

  describe('parseVCard - Metadata', () => {
    it('should preserve raw vCard text', () => {
      const vCard = 'BEGIN:VCARD\nVERSION:4.0\nFN:Test\nEND:VCARD';
      const parsed = parseVCard(vCard);

      expect(parsed.rawVCard).toBe(vCard);
    });

    it('should set version in result', () => {
      const vCard = 'BEGIN:VCARD\nVERSION:4.0\nFN:Test\nEND:VCARD';
      const parsed = parseVCard(vCard);

      expect(parsed.version).toBe('4.0');
    });
  });
});
