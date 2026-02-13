/**
 * vCard transformation utilities
 * Bidirectional conversion between Nametag Person model and vCard 3.0 format
 *
 * RFC 2426: vCard MIME Directory Profile (v3.0)
 * https://datatracker.ietf.org/doc/html/rfc2426
 *
 * vCard 3.0 format details:
 * - Date format: YYYYMMDD (not YYYY-MM-DD)
 * - Photo encoding: ENCODING=b parameter (not data URI)
 * - Special dates: Both X-ABDATE (Apple) and X-ANNIVERSARY (Android) for compatibility
 * - Line folding: 75 character limit with CRLF + SPACE continuation
 */

import type { PersonWithRelations, ParsedVCardData } from './carddav/types';
import { parseVCard } from './carddav/vcard-parser';

export interface VCardOptions {
  includePhoto?: boolean; // Default: true (requires base64 encoding)
  includeCustomFields?: boolean; // Default: true (X- properties)
  stripMarkdown?: boolean; // Default: false
}

const DEFAULT_OPTIONS: VCardOptions = {
  includePhoto: true,
  includeCustomFields: true,
  stripMarkdown: false,
};

/**
 * Convert Person model to vCard 3.0 string
 */
export function personToVCard(
  person: PersonWithRelations,
  options: VCardOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [];

  // vCard header
  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');

  // UID - optional in v3.0 but required for CardDAV sync
  if (person.uid) {
    lines.push(`UID:${person.uid}`);
  }

  // FN (Formatted Name) - required
  const fullName = formatFullName(person);
  lines.push(buildV3Property('FN', {}, fullName));

  // N (Structured Name) - surname;given;middle;prefix;suffix
  // RFC 2426: Family name field should include all surnames
  // For Spanish naming: combine surname + secondLastName with space
  const familyName = [person.surname, person.secondLastName]
    .filter(Boolean)
    .join(' ');

  const structuredName = [
    familyName || '',
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
    lines.push(buildV3Property('NICKNAME', {}, person.nickname));
  }

  // BDAY (Birthday) - get from ImportantDates
  const birthday = person.importantDates.find(
    (d) => d.title.toLowerCase() === 'birthday'
  );
  if (birthday) {
    lines.push(`BDAY:${formatVCardV3Date(birthday.date)}`);
  }

  // Special dates - use BOTH X-ABDATE and X-ANNIVERSARY for maximum compatibility
  const otherDates = person.importantDates.filter(
    (d) => d.title.toLowerCase() !== 'birthday'
  );

  let itemCounter = 1;
  otherDates.forEach((date) => {
    const label = escapeVCardText(date.title);
    const dateValue = formatVCardV3Date(date.date);

    // X-ABDATE format (Apple)
    lines.push(`item${itemCounter}.X-ABDATE;VALUE=date-and-or-time:${dateValue}`);
    lines.push(`item${itemCounter}.X-ABLabel:${label}`);

    // X-ANNIVERSARY format (Android)
    lines.push(`X-ANNIVERSARY;TYPE=${label.toUpperCase()}:${dateValue}`);

    itemCounter++;
  });

  // TEL (Phone numbers)
  person.phoneNumbers.forEach((phone) => {
    const type = phone.type.toUpperCase();
    // Convert "MOBILE" to "CELL" for v3.0 compatibility
    const v3Type = type === 'MOBILE' ? 'CELL' : type;
    lines.push(buildV3Property('TEL', { TYPE: v3Type }, phone.number));
  });

  // EMAIL
  person.emails.forEach((email) => {
    const type = email.type.toUpperCase();
    lines.push(buildV3Property('EMAIL', { TYPE: type }, email.email));
  });

  // ADR (Address) - ;;street;locality;region;postal;country
  person.addresses.forEach((addr) => {
    const type = addr.type.toUpperCase();

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
    // Build ADR line directly (don't use buildV3Property which would escape the semicolons)
    lines.push(`ADR;TYPE=${type}:${adrValue}`);
  });

  // URL - use item grouping with X-ABLabel for better compatibility
  person.urls.forEach((url) => {
    const label = escapeVCardText(url.type);
    lines.push(`item${itemCounter}.URL:${escapeVCardText(url.url)}`);
    lines.push(`item${itemCounter}.X-ABLabel:${label}`);
    itemCounter++;
  });

  // IMPP (Instant Messaging) - use item grouping with X-ABLabel
  person.imHandles.forEach((im) => {
    const protocol = im.protocol.toLowerCase();
    const label = escapeVCardText(im.protocol);
    lines.push(`item${itemCounter}.IMPP:${protocol}:${escapeVCardText(im.handle)}`);
    lines.push(`item${itemCounter}.X-ABLabel:${label}`);
    itemCounter++;
  });

  // GEO (Geographic location) - use item grouping with X-ABLabel
  // Deduplicate by lat/lon/type to avoid repeated entries from import
  const seenLocations = new Set<string>();
  person.locations.forEach((loc) => {
    const locKey = `${loc.latitude};${loc.longitude};${loc.type}`;
    if (seenLocations.has(locKey)) return;
    seenLocations.add(locKey);

    const label = escapeVCardText(loc.type);
    // vCard 3.0 format: GEO:latitude;longitude (not geo: URI)
    lines.push(`item${itemCounter}.GEO:${loc.latitude};${loc.longitude}`);
    lines.push(`item${itemCounter}.X-ABLabel:${label}`);
    itemCounter++;
  });

  // ORG (Organization)
  if (person.organization) {
    lines.push(buildV3Property('ORG', {}, person.organization));
  }

  // TITLE (Job title)
  if (person.jobTitle) {
    lines.push(buildV3Property('TITLE', {}, person.jobTitle));
  }

  // PHOTO - export as URL if available
  // vCard 3.0 supports both embedded base64 and external URLs
  // For URLs, use VALUE=uri parameter
  if (opts.includePhoto && person.photo) {
    if (person.photo.startsWith('data:')) {
      // Skip data URIs for now - would need base64 extraction and line folding
      // This can be added later via addPhotoToVCard() helper
    } else {
      // Export as external URL reference
      lines.push(buildV3Property('PHOTO', { VALUE: 'uri' }, person.photo));
    }
  }

  // GENDER - v3.0 doesn't have GENDER, use X-GENDER
  if (person.gender) {
    lines.push(`X-GENDER:${person.gender}`);
  }

  // NOTE
  if (person.notes) {
    let notes = person.notes;
    if (opts.stripMarkdown) {
      notes = stripMarkdown(notes);
    }
    lines.push(buildV3Property('NOTE', {}, notes));
  }

  // CATEGORIES (Groups)
  if (person.groups.length > 0) {
    const categories = person.groups
      .map((pg) => escapeVCardText(pg.group.name))
      .join(',');
    lines.push(`CATEGORIES:${categories}`);
  }

  // Custom fields (X- properties)
  // Deduplicate by normalized key+value to avoid duplicates from imports
  // (e.g., both ROLE and X-ROLE stored as custom fields produce the same X-ROLE output)
  if (opts.includeCustomFields) {
    const seenCustomFields = new Set<string>();
    person.customFields.forEach((field) => {
      const key = field.key.startsWith('X-') ? field.key : `X-${field.key}`;
      const dedupKey = `${key}:${field.value}`;
      if (seenCustomFields.has(dedupKey)) return;
      seenCustomFields.add(dedupKey);
      lines.push(buildV3Property(key, {}, field.value));
    });

    // Store second last name separately for preservation (Spanish naming convention)
    // Note: Already included in N property's family-name field per RFC 2426
    // This extension allows apps to distinguish between surname and secondLastName on re-import
    if (person.secondLastName) {
      lines.push(buildV3Property('X-NAMETAG-SECOND-LASTNAME', {}, person.secondLastName));
    }
  }

  // vCard footer
  lines.push('END:VCARD');

  // Apply line folding to all lines
  const foldedLines = lines.flatMap(line => foldLine(line));

  return foldedLines.join('\r\n');
}

/**
 * Convert multiple people to combined vCard file
 */
export function peopleToVCard(
  people: PersonWithRelations[],
  options: VCardOptions = {}
): string {
  return people
    .map(person => personToVCard(person, options))
    .join('\r\n');
}

/**
 * Parse vCard string to Person data structure
 * Uses the enhanced parser which handles both v3.0 and v4.0, vendor extensions, etc.
 */
export function vCardToPerson(vCardText: string): ParsedVCardData {
  return parseVCard(vCardText);
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
 * Format date for vCard 3.0 (YYYYMMDD or --MMDD for year-omitted)
 */
export function formatVCardV3Date(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  // If year is 1604 or earlier, omit it (year unknown - Apple uses 1604 as marker)
  if (year <= 1604) {
    return `--${month}${day}`;
  }

  return `${year}${month}${day}`;
}

/**
 * Fold lines longer than 75 characters per RFC 2426
 * Continuation lines start with a single space
 */
export function foldLine(line: string): string[] {
  if (line.length <= 75) {
    return [line];
  }

  const lines: string[] = [];
  let remaining = line;

  // First line: up to 75 characters
  lines.push(remaining.substring(0, 75));
  remaining = remaining.substring(75);

  // Continuation lines: space + up to 74 characters
  while (remaining.length > 0) {
    const chunk = remaining.substring(0, 74);
    lines.push(' ' + chunk);
    remaining = remaining.substring(74);
  }

  return lines;
}

/**
 * Build vCard 3.0 property line with parameters
 */
export function buildV3Property(
  property: string,
  params: Record<string, string>,
  value: string
): string {
  let line = property;

  // Add parameters (e.g., ;TYPE=WORK)
  Object.entries(params).forEach(([key, val]) => {
    line += `;${key}=${val}`;
  });

  line += `:${escapeVCardText(value)}`;

  return line;
}

/**
 * Escape special characters in vCard text
 */
export function escapeVCardText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
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

/**
 * Add photo to vCard 3.0 with proper encoding
 * This should be called with base64-encoded photo data
 */
export function addPhotoToVCard(
  vcard: string,
  base64Data: string,
  mimeType: string
): string {
  const lines = vcard.split('\r\n');
  const endIndex = lines.findIndex(line => line === 'END:VCARD');

  if (endIndex === -1) {
    throw new Error('Invalid vCard: missing END:VCARD');
  }

  // Determine photo type (JPEG, PNG, etc.)
  const type = mimeType.split('/')[1].toUpperCase();

  // Build photo property with encoding
  const photoProperty = `PHOTO;ENCODING=b;TYPE=${type}:${base64Data}`;

  // Apply line folding
  const foldedPhoto = foldLine(photoProperty);

  // Insert before END:VCARD
  lines.splice(endIndex, 0, ...foldedPhoto);

  return lines.join('\r\n');
}
