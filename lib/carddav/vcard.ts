/**
 * vCard 4.0 transformation utilities
 * Bidirectional conversion between Nametag Person model and vCard format
 *
 * RFC 6350: vCard Format Specification
 * https://datatracker.ietf.org/doc/html/rfc6350
 */

import type { PersonWithRelations, ParsedVCardData, VCardOptions } from './types';
import { parseVCard as parseVCardEnhanced } from './vcard-parser';
import { randomUUID } from 'crypto';

const DEFAULT_OPTIONS: VCardOptions = {
  version: '4.0',
  includeNametag: true,
  includeRelationships: true,
  stripMarkdown: false,
};

/**
 * Convert Person model to vCard 4.0 string
 */
export function personToVCard(
  person: PersonWithRelations,
  options: VCardOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [];

  // vCard header
  lines.push('BEGIN:VCARD');
  lines.push(`VERSION:${opts.version}`);

  // UID (required) - generate if missing
  const uid = person.uid || `urn:uuid:${randomUUID()}`;
  lines.push(`UID:${uid}`);

  // FN (Formatted Name) - required
  const fullName = formatFullName(person);
  lines.push(`FN:${escapeVCardText(fullName)}`);

  // N (Structured Name) - surname;given;middle;prefix;suffix
  const structuredName = [
    person.surname || '',
    person.name || '',
    person.middleName || '',
    person.prefix || '',
    person.suffix || '',
  ]
    .map(escapeVCardText)
    .join(';');
  lines.push(`N:${structuredName}`);

  // NICKNAME
  if (person.nickname) {
    lines.push(`NICKNAME:${escapeVCardText(person.nickname)}`);
  }

  // BDAY (Birthday) - get from ImportantDates
  const birthday = person.importantDates.find(
    (d) => d.title.toLowerCase() === 'birthday'
  );
  if (birthday) {
    lines.push(`BDAY:${formatVCardDate(birthday.date)}`);
  }

  // ANNIVERSARY - other important dates + lastContact
  const otherDates = person.importantDates.filter(
    (d) => d.title.toLowerCase() !== 'birthday'
  );
  otherDates.forEach((date) => {
    const label = escapeVCardText(date.title);
    lines.push(
      `ANNIVERSARY;TYPE=${label.toUpperCase()}:${formatVCardDate(date.date)}`
    );
  });

  // Add lastContact as ANNIVERSARY with TYPE=LAST-CONTACT
  if (person.lastContact) {
    lines.push(
      `ANNIVERSARY;TYPE=LAST-CONTACT:${formatVCardDate(person.lastContact)}`
    );
  }

  // TEL (Phone numbers)
  person.phoneNumbers.forEach((phone) => {
    const types = phone.type.toUpperCase();
    lines.push(`TEL;TYPE=${types}:${phone.number}`);
  });

  // EMAIL
  person.emails.forEach((email) => {
    const types = email.type.toUpperCase();
    lines.push(`EMAIL;TYPE=${types}:${email.email}`);
  });

  // ADR (Address) - ;;street;locality;region;postal;country
  person.addresses.forEach((addr) => {
    const types = addr.type.toUpperCase();

    // Combine streetLine1 and streetLine2 with newline separator
    const streetValue = [addr.streetLine1, addr.streetLine2]
      .filter(Boolean)
      .join('\n');

    const adrValue = [
      '', // Post office box (not used)
      '', // Extended address (not used)
      streetValue,
      addr.locality || '',
      addr.region || '',
      addr.postalCode || '',
      addr.country || '',
    ]
      .map(escapeVCardText)
      .join(';');
    lines.push(`ADR;TYPE=${types}:${adrValue}`);
  });

  // URL
  person.urls.forEach((url) => {
    const types = url.type.toUpperCase();
    lines.push(`URL;TYPE=${types}:${url.url}`);
  });

  // IMPP (Instant Messaging)
  person.imHandles.forEach((im) => {
    const protocol = im.protocol.toLowerCase();
    lines.push(`IMPP:${protocol}:${im.handle}`);
  });

  // GEO (Geographic location)
  person.locations.forEach((loc) => {
    const types = loc.type.toUpperCase();
    lines.push(`GEO;TYPE=${types}:geo:${loc.latitude},${loc.longitude}`);
  });

  // ORG (Organization)
  if (person.organization) {
    lines.push(`ORG:${escapeVCardText(person.organization)}`);
  }

  // TITLE (Job title)
  if (person.jobTitle) {
    lines.push(`TITLE:${escapeVCardText(person.jobTitle)}`);
  }

  // PHOTO
  if (person.photo) {
    lines.push(`PHOTO:${person.photo}`);
  }

  // GENDER
  if (person.gender) {
    lines.push(`GENDER:${person.gender}`);
  }

  // NOTE
  if (person.notes) {
    let notes = person.notes;
    if (opts.stripMarkdown) {
      notes = stripMarkdown(notes);
    }
    lines.push(`NOTE:${escapeVCardText(notes)}`);
  }

  // CATEGORIES (Groups)
  if (person.groups.length > 0) {
    const categories = person.groups.map((pg) => escapeVCardText(pg.group.name)).join(',');
    lines.push(`CATEGORIES:${categories}`);
  }

  // RELATED (Relationships)
  if (opts.includeRelationships && person.relationshipsFrom.length > 0) {
    person.relationshipsFrom.forEach((rel) => {
      const relatedUid = rel.relatedPerson.uid;
      if (relatedUid) {
        // Type is stored in relationshipTypeId - we'd need to load the type
        // For now, use a generic RELATED property
        lines.push(`RELATED:urn:uuid:${relatedUid}`);
      }
    });
  }

  // Custom fields (X- properties)
  person.customFields.forEach((field) => {
    const key = field.key.startsWith('X-') ? field.key : `X-${field.key}`;
    lines.push(`${key}:${escapeVCardText(field.value)}`);
  });

  // Nametag-specific extensions
  if (opts.includeNametag) {
    // Store relationship graph as JSON for full preservation
    if (person.relationshipsFrom.length > 0) {
      const relJson = JSON.stringify(
        person.relationshipsFrom.map((r) => ({
          personId: r.relatedPersonId,
          typeId: r.relationshipTypeId,
          notes: r.notes,
        }))
      );
      lines.push(`X-NAMETAG-RELATIONSHIPS:${escapeVCardText(relJson)}`);
    }

    // Store second last name (Spanish naming convention)
    if (person.secondLastName) {
      lines.push(`X-NAMETAG-SECOND-LASTNAME:${escapeVCardText(person.secondLastName)}`);
    }

    // Store contact reminder settings
    if (person.contactReminderEnabled) {
      lines.push(`X-NAMETAG-CONTACT-REMINDER:enabled`);
      if (person.contactReminderInterval && person.contactReminderIntervalUnit) {
        lines.push(
          `X-NAMETAG-REMINDER-INTERVAL:${person.contactReminderInterval} ${person.contactReminderIntervalUnit}`
        );
      }
    }
  }

  // vCard footer
  lines.push('END:VCARD');

  return lines.join('\r\n');
}

/**
 * Parse vCard string to Person data structure
 * Now uses the enhanced parser with full v3/v4 support and vendor extensions
 */
export function vCardToPerson(vCardText: string): ParsedVCardData {
  // Use the enhanced parser which handles both v3 and v4, vendor extensions, etc.
  return parseVCardEnhanced(vCardText);
}

/**
 * Format full name from Person fields
 */
function formatFullName(person: PersonWithRelations): string {
  const parts: string[] = [];

  if (person.prefix) parts.push(person.prefix);
  if (person.name) parts.push(person.name);
  if (person.middleName) parts.push(person.middleName);
  if (person.surname) parts.push(person.surname);
  if (person.secondLastName) parts.push(person.secondLastName);
  if (person.suffix) parts.push(person.suffix);
  if (person.nickname && parts.length === 0) parts.push(person.nickname);

  return parts.join(' ') || 'Unknown';
}

/**
 * Format date for vCard (YYYY-MM-DD or --MM-DD for year-omitted)
 */
function formatVCardDate(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  // If year is 1604 or earlier, omit it (year unknown - Apple uses 1604 as marker)
  if (year <= 1604) {
    return `--${month}-${day}`;
  }

  return `${year}-${month}-${day}`;
}

/**
 * Escape special characters in vCard text
 */
function escapeVCardText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

/**
 * Unescape vCard text
 */
function unescapeVCardText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\;/g, ';')
    .replace(/\\,/g, ',')
    .replace(/\\\\/g, '\\');
}

/**
 * Strip markdown formatting (basic)
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
    .replace(/\*(.+?)\*/g, '$1') // Italic
    .replace(/#{1,6}\s(.+)/g, '$1') // Headers
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
    .replace(/`(.+?)`/g, '$1'); // Code
}
