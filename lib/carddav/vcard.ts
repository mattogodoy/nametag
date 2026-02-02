/**
 * vCard 4.0 transformation utilities
 * Bidirectional conversion between Nametag Person model and vCard format
 *
 * RFC 6350: vCard Format Specification
 * https://datatracker.ietf.org/doc/html/rfc6350
 */

import type { PersonWithRelations, ParsedVCardData, VCardOptions } from './types';
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
 * Parse vCard 4.0 string to Person data structure
 */
export function vCardToPerson(vCardText: string): ParsedVCardData {
  const lines = parseVCardLines(vCardText);
  const data: ParsedVCardData = {
    name: '',
    phoneNumbers: [],
    emails: [],
    addresses: [],
    urls: [],
    imHandles: [],
    locations: [],
    importantDates: [],
    categories: [],
    customFields: [],
  };

  for (const line of lines) {
    const { property, params, value } = line;

    switch (property) {
      case 'FN':
        // Use FN as fallback name if N is not present
        if (!data.name) {
          data.name = value;
        }
        break;

      case 'N': {
        // N = surname;given;middle;prefix;suffix
        const parts = value.split(';');
        data.surname = parts[0] || undefined;
        data.name = parts[1] || data.name; // Prefer N over FN
        data.middleName = parts[2] || undefined;
        data.prefix = parts[3] || undefined;
        data.suffix = parts[4] || undefined;
        break;
      }

      case 'NICKNAME':
        data.nickname = value;
        break;

      case 'UID':
        data.uid = value;
        break;

      case 'BDAY': {
        const date = parseVCardDate(value);
        if (date) {
          data.importantDates.push({ title: 'Birthday', date });
        }
        break;
      }

      case 'ANNIVERSARY': {
        const date = parseVCardDate(value);
        if (date) {
          const type = params.TYPE || 'Anniversary';
          if (type.toUpperCase() === 'LAST-CONTACT') {
            data.lastContact = date;
          } else {
            data.importantDates.push({ title: type, date });
          }
        }
        break;
      }

      case 'TEL': {
        const type = params.TYPE || 'other';
        data.phoneNumbers.push({ type, number: value });
        break;
      }

      case 'EMAIL': {
        const type = params.TYPE || 'other';
        data.emails.push({ type, email: value });
        break;
      }

      case 'ADR': {
        // ADR = ;;street;locality;region;postal;country
        const parts = value.split(';');
        const type = params.TYPE || 'other';

        // Split street component on newline to get streetLine1 and streetLine2
        const streetPart = parts[2] || '';
        const streetLines = streetPart.split('\n');
        const streetLine1 = streetLines[0] || undefined;
        const streetLine2 = streetLines[1] || undefined;

        data.addresses.push({
          type,
          streetLine1,
          streetLine2,
          locality: parts[3] || undefined,
          region: parts[4] || undefined,
          postalCode: parts[5] || undefined,
          country: parts[6] || undefined,
        });
        break;
      }

      case 'URL': {
        const type = params.TYPE || 'personal';
        data.urls.push({ type, url: value });
        break;
      }

      case 'IMPP': {
        // IMPP = protocol:handle (e.g., skype:username)
        const colonIndex = value.indexOf(':');
        if (colonIndex > 0) {
          const protocol = value.substring(0, colonIndex);
          const handle = value.substring(colonIndex + 1);
          data.imHandles.push({ protocol, handle });
        }
        break;
      }

      case 'GEO': {
        // GEO = geo:lat,lon
        const geoMatch = value.match(/geo:([-\d.]+),([-\d.]+)/);
        if (geoMatch) {
          const type = params.TYPE || 'other';
          data.locations.push({
            type,
            latitude: parseFloat(geoMatch[1]),
            longitude: parseFloat(geoMatch[2]),
          });
        }
        break;
      }

      case 'ORG': {
        // ORG = CompanyName (just use first component)
        const parts = value.split(';');
        data.organization = parts[0] || undefined;
        break;
      }

      case 'TITLE':
        data.jobTitle = value;
        break;

      case 'PHOTO':
        data.photo = value;
        break;

      case 'GENDER':
        data.gender = value;
        break;

      case 'NOTE':
        data.notes = value;
        break;

      case 'CATEGORIES':
        data.categories = value.split(',').map((c) => c.trim());
        break;

      default:
        // Handle X- custom properties
        if (property.startsWith('X-')) {
          // Nametag-specific extensions
          if (property === 'X-NAMETAG-SECOND-LASTNAME') {
            // This will be handled separately in the Person creation
            data.customFields.push({ key: property, value });
          } else {
            data.customFields.push({ key: property, value });
          }
        }
        break;
    }
  }

  return data;
}

/**
 * Parse vCard text into structured lines
 */
function parseVCardLines(vCardText: string): Array<{
  property: string;
  params: Record<string, string>;
  value: string;
}> {
  const lines: Array<{ property: string; params: Record<string, string>; value: string }> =
    [];

  // Unfold lines (lines starting with space or tab are continuations)
  const rawLines = vCardText.split(/\r?\n/);
  const unfoldedLines: string[] = [];
  let currentLine = '';

  for (const line of rawLines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      currentLine += line.substring(1);
    } else {
      if (currentLine) {
        unfoldedLines.push(currentLine);
      }
      currentLine = line;
    }
  }
  if (currentLine) {
    unfoldedLines.push(currentLine);
  }

  // Parse each line
  for (const line of unfoldedLines) {
    if (line === 'BEGIN:VCARD' || line === 'END:VCARD' || line === 'VERSION:4.0') {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const propertyPart = line.substring(0, colonIndex);
    const value = unescapeVCardText(line.substring(colonIndex + 1));

    // Parse property and parameters
    const semicolonIndex = propertyPart.indexOf(';');
    let property: string;
    let paramsStr: string;

    if (semicolonIndex === -1) {
      property = propertyPart;
      paramsStr = '';
    } else {
      property = propertyPart.substring(0, semicolonIndex);
      paramsStr = propertyPart.substring(semicolonIndex + 1);
    }

    // Parse parameters
    const params: Record<string, string> = {};
    if (paramsStr) {
      const paramPairs = paramsStr.split(';');
      for (const pair of paramPairs) {
        const eqIndex = pair.indexOf('=');
        if (eqIndex > 0) {
          const key = pair.substring(0, eqIndex).trim();
          let val = pair.substring(eqIndex + 1).trim();
          // Remove quotes
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
          }
          params[key] = val;
        }
      }
    }

    lines.push({ property, params, value });
  }

  return lines;
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

  // If year is before 1900, omit it (year unknown)
  if (year < 1900) {
    return `--${month}-${day}`;
  }

  return `${year}-${month}-${day}`;
}

/**
 * Parse vCard date (YYYY-MM-DD or --MM-DD)
 */
function parseVCardDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Handle --MM-DD (year omitted)
  if (dateStr.startsWith('--')) {
    const parts = dateStr.substring(2).split('-');
    if (parts.length === 2) {
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      // Use year 1900 to indicate unknown year
      return new Date(1900, month - 1, day);
    }
  }

  // Handle YYYY-MM-DD
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  return null;
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
