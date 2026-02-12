/**
 * Enhanced vCard Parser
 * Supports both vCard 3.0 and 4.0 with vendor-specific extensions (Apple, Google)
 * Modular design for easy testing and maintenance
 */

import type { ParsedVCardData } from './types';

/**
 * Unknown property that wasn't explicitly handled
 */
export interface UnknownProperty {
  key: string;
  value: string;
  group?: string;
  params: Record<string, string | string[]>;
}

/**
 * Enhanced parsed vCard data with metadata
 */
export interface ParsedVCardDataEnhanced extends ParsedVCardData {
  version: '3.0' | '4.0';
  unknownProperties: UnknownProperty[];
  rawVCard: string;
}

/**
 * Parsed property line
 */
export interface ParsedProperty {
  property: string;
  group?: string;
  params: Record<string, string | string[]>;
  value: string;
  rawLine: string;
}

/**
 * Item group (for v3 item1.URL + item1.X-ABLabel associations)
 */
export interface ItemGroup {
  [key: string]: ParsedProperty[];
}

/**
 * Main parser function - converts vCard text to Person data structure
 */
export function parseVCard(vCardText: string): ParsedVCardDataEnhanced {
  const version = detectVCardVersion(vCardText);
  const properties = parseProperties(vCardText, version);
  const itemGroups = associateItemGroups(properties);

  const data: ParsedVCardDataEnhanced = {
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
    version,
    unknownProperties: [],
    rawVCard: vCardText,
  };

  const handledProperties = new Set<string>();

  // Process each property
  for (const prop of properties) {
    const handled = processProperty(prop, data, version, itemGroups);
    if (handled) {
      handledProperties.add(prop.rawLine);
    }
  }

  // Collect unknown properties
  data.unknownProperties = collectUnknownProperties(properties, handledProperties);

  // Add unknown properties to notes field
  if (data.unknownProperties.length > 0) {
    const unknownSection = formatUnknownPropertiesForNotes(data.unknownProperties);
    data.notes = data.notes ? `${data.notes}\n\n${unknownSection}` : unknownSection;
  }

  return data;
}

/**
 * Detect vCard version from text
 */
export function detectVCardVersion(vCardText: string): '3.0' | '4.0' {
  const versionMatch = vCardText.match(/VERSION:([\d.]+)/);
  if (!versionMatch) {
    return '3.0'; // Default to 3.0 for better compatibility
  }

  const version = versionMatch[1];
  if (version === '4.0') {
    return '4.0';
  }

  return '3.0'; // Treat 2.1, 3.0, and unknown as 3.0
}

/**
 * Parse vCard text into structured properties
 */
export function parseProperties(vCardText: string, version: '3.0' | '4.0'): ParsedProperty[] {
  const properties: ParsedProperty[] = [];

  // Unfold lines (lines starting with space or tab are continuations)
  const unfoldedLines = unfoldLines(vCardText);

  // Parse each line
  for (const line of unfoldedLines) {
    // Skip vCard delimiters
    if (line === 'BEGIN:VCARD' || line === 'END:VCARD' || line.startsWith('VERSION:')) {
      continue;
    }

    const prop = parsePropertyLine(line, version);
    if (prop) {
      properties.push(prop);
    }
  }

  return properties;
}

/**
 * Unfold multi-line vCard values
 */
function unfoldLines(vCardText: string): string[] {
  const rawLines = vCardText.split(/\r?\n/);
  const unfoldedLines: string[] = [];
  let currentLine = '';

  for (const line of rawLines) {
    // Continuation lines start with space or tab
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

  return unfoldedLines;
}

/**
 * Parse a single property line
 */
function parsePropertyLine(line: string, version: '3.0' | '4.0'): ParsedProperty | null {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }

  const propertyPart = line.substring(0, colonIndex);
  const value = unescapeVCardText(line.substring(colonIndex + 1));

  // Check for group prefix (item1.URL)
  let group: string | undefined;
  let propertyWithParams: string;

  const dotIndex = propertyPart.indexOf('.');
  if (dotIndex !== -1 && dotIndex < propertyPart.indexOf(';')) {
    // Group found before parameters
    group = propertyPart.substring(0, dotIndex);
    propertyWithParams = propertyPart.substring(dotIndex + 1);
  } else if (dotIndex !== -1 && !propertyPart.includes(';')) {
    // Group found, no parameters
    group = propertyPart.substring(0, dotIndex);
    propertyWithParams = propertyPart.substring(dotIndex + 1);
  } else {
    propertyWithParams = propertyPart;
  }

  // Parse property and parameters
  const semicolonIndex = propertyWithParams.indexOf(';');
  let property: string;
  let paramsStr: string;

  if (semicolonIndex === -1) {
    property = propertyWithParams;
    paramsStr = '';
  } else {
    property = propertyWithParams.substring(0, semicolonIndex);
    paramsStr = propertyWithParams.substring(semicolonIndex + 1);
  }

  // Parse parameters (different for v3 vs v4)
  const params = parseParameters(paramsStr, version);

  return {
    property: property.toUpperCase(),
    group,
    params,
    value,
    rawLine: line,
  };
}

/**
 * Parse parameter string (handles v3 and v4 differences)
 */
function parseParameters(
  paramsStr: string,
  version: '3.0' | '4.0'
): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};

  if (!paramsStr) {
    return params;
  }

  // Split by semicolon, but respect quoted values
  const paramPairs = splitRespectingQuotes(paramsStr, ';');

  for (const pair of paramPairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      // Parameter without value (v3 can have TYPE=HOME,WORK)
      continue;
    }

    const key = pair.substring(0, eqIndex).trim().toUpperCase();
    let val = pair.substring(eqIndex + 1).trim();

    // Remove quotes
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }

    // Handle multi-value parameters
    // v3: TYPE=HOME,WORK or TYPE=INTERNET;TYPE=HOME
    // v4: TYPE="work,voice"
    if (key === 'TYPE') {
      const values = val.split(',').map((v) => v.trim().toLowerCase());

      // Merge with existing TYPE values
      if (params.TYPE) {
        const existing = Array.isArray(params.TYPE) ? params.TYPE : [params.TYPE];
        params.TYPE = [...existing, ...values];
      } else {
        params.TYPE = values.length === 1 ? values[0] : values;
      }
    } else {
      params[key] = val;
    }
  }

  return params;
}

/**
 * Split string by delimiter, respecting quoted sections
 */
function splitRespectingQuotes(str: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === delimiter && !inQuotes) {
      if (current) {
        parts.push(current);
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

/**
 * Associate properties by item group
 */
export function associateItemGroups(properties: ParsedProperty[]): ItemGroup {
  const groups: ItemGroup = {};

  for (const prop of properties) {
    if (prop.group) {
      if (!groups[prop.group]) {
        groups[prop.group] = [];
      }
      groups[prop.group].push(prop);
    }
  }

  return groups;
}

/**
 * Process a single property and update data
 * Returns true if property was handled
 */
function processProperty(
  prop: ParsedProperty,
  data: ParsedVCardDataEnhanced,
  version: '3.0' | '4.0',
  itemGroups: ItemGroup
): boolean {
  switch (prop.property) {
    case 'FN':
      // Use FN as fallback name if N is not present
      if (!data.name) {
        data.name = prop.value;
      }
      return true;

    case 'N': {
      // N = surname;given;middle;prefix;suffix
      const parts = prop.value.split(';');
      data.surname = parts[0] || undefined;
      data.name = parts[1] || data.name; // Prefer N over FN
      data.middleName = parts[2] || undefined;
      data.prefix = parts[3] || undefined;
      data.suffix = parts[4] || undefined;
      return true;
    }

    case 'NICKNAME': {
      // v4 can have multiple nicknames comma-separated
      const nicknames = prop.value.split(',').map((n) => n.trim());
      data.nickname = nicknames[0] || undefined;
      return true;
    }

    case 'UID':
      data.uid = prop.value;
      return true;

    case 'BDAY': {
      // Handle X-APPLE-OMIT-YEAR parameter
      const date = parseVCardDate(prop.value, prop.params['X-APPLE-OMIT-YEAR']);
      if (date) {
        data.importantDates.push({ title: 'Birthday', date });
      }
      return true;
    }

    case 'ANNIVERSARY': {
      const date = parseVCardDate(prop.value);
      if (date) {
        const typeParam = prop.params.TYPE;
        const type = Array.isArray(typeParam) ? typeParam[0] : typeParam;

        if (type && type.toUpperCase() === 'LAST-CONTACT') {
          data.lastContact = date;
        } else {
          const title = type || 'Anniversary';
          data.importantDates.push({ title, date });
        }
      }
      return true;
    }

    case 'TEL': {
      const typeParam = prop.params.TYPE || 'other';
      const types = Array.isArray(typeParam) ? typeParam : [typeParam];
      const type = types[0] || 'other';

      data.phoneNumbers.push({ type, number: prop.value });
      return true;
    }

    case 'EMAIL': {
      const typeParam = prop.params.TYPE || 'other';
      const types = Array.isArray(typeParam) ? typeParam : [typeParam];
      // Filter out 'internet' which is redundant
      const filteredTypes = types.filter((t) => t.toLowerCase() !== 'internet');
      const type = filteredTypes[0] || 'other';

      data.emails.push({ type, email: prop.value });
      return true;
    }

    case 'ADR': {
      // ADR = ;;street;locality;region;postal;country
      const parts = prop.value.split(';');
      const typeParam = prop.params.TYPE || 'other';
      const types = Array.isArray(typeParam) ? typeParam : [typeParam];
      const type = types[0] || 'other';

      // Split street component on newline
      const streetPart = parts[2] || '';
      const streetLines = streetPart.split('\n');

      data.addresses.push({
        type,
        streetLine1: streetLines[0] || undefined,
        streetLine2: streetLines[1] || undefined,
        locality: parts[3] || undefined,
        region: parts[4] || undefined,
        postalCode: parts[5] || undefined,
        country: parts[6] || undefined,
      });
      return true;
    }

    case 'URL': {
      // Check for item group label
      const label = prop.group ? getItemGroupLabel(prop.group, itemGroups) : undefined;
      const type = label || getParamType(prop.params) || 'personal';

      data.urls.push({ type, url: prop.value });
      return true;
    }

    case 'IMPP': {
      // IMPP = protocol:handle
      const parsed = parseIMPP(prop.value);
      if (parsed) {
        data.imHandles.push(parsed);
      }
      return true;
    }

    case 'GEO': {
      const parsed = parseGEO(prop.value);
      if (parsed) {
        const type = getParamType(prop.params) || 'other';
        data.locations.push({ type, ...parsed });
      }
      return true;
    }

    case 'ORG': {
      // ORG can be structured: company;department;team
      const parts = prop.value.split(';');
      data.organization = parts[0] || undefined;
      return true;
    }

    case 'TITLE':
      data.jobTitle = prop.value;
      return true;

    case 'PHOTO': {
      // Handle both URLs and base64 encoded images
      const encoding = prop.params.ENCODING;
      const typeParam = prop.params.TYPE;
      const type = Array.isArray(typeParam) ? typeParam[0] : typeParam;

      if (prop.value.startsWith('http://') || prop.value.startsWith('https://')) {
        // Already a URL
        data.photo = prop.value;
      } else if (prop.value.startsWith('data:')) {
        // Already a data URI
        data.photo = prop.value;
      } else if (encoding === 'b' || encoding === 'BASE64' || encoding === 'base64') {
        // Base64 encoded - convert to data URI
        const mimeType = type ? `image/${type.toLowerCase()}` : 'image/jpeg';
        // Remove any whitespace from base64 string
        const cleanBase64 = prop.value.replace(/\s/g, '');
        data.photo = `data:${mimeType};base64,${cleanBase64}`;
      } else {
        // Unknown format, keep as-is
        data.photo = prop.value;
      }
      return true;
    }

    case 'GENDER':
      data.gender = prop.value;
      return true;

    case 'NOTE':
      data.notes = prop.value;
      return true;

    case 'CATEGORIES':
      data.categories = prop.value.split(',').map((c) => c.trim());
      return true;

    // Vendor-specific properties
    case 'X-ABDATE': {
      // Apple custom date with label in item group
      const date = parseVCardDate(prop.value);
      if (date && prop.group) {
        const label = getItemGroupLabel(prop.group, itemGroups) || 'Important Date';
        data.importantDates.push({ title: label, date });
      }
      return true;
    }

    case 'X-SOCIALPROFILE': {
      // Apple social profile → IM handle
      const parsed = parseSocialProfile(prop.value, prop.params);
      if (parsed) {
        data.imHandles.push(parsed);
      }
      return true;
    }

    case 'X-ABRELATEDNAMES': {
      // Apple related names - store as custom field for now
      // (relationships need person IDs, can't be created from vCard alone)
      data.customFields.push({
        key: 'X-ABRELATEDNAMES',
        value: prop.value,
        type: prop.group ? getItemGroupLabel(prop.group, itemGroups) : undefined,
      });
      return true;
    }

    // Properties to preserve as custom fields
    case 'ROLE':
    case 'LANG':
    case 'TZ':
    case 'KEY':
    case 'REV':
    case 'PRODID':
    case 'RELATED': {
      data.customFields.push({
        key: prop.property,
        value: prop.value,
      });
      return true;
    }

    default:
      // Handle X- custom properties
      if (prop.property.startsWith('X-')) {
        // Skip X-ABLabel (used only for labeling other properties)
        if (prop.property === 'X-ABLABEL') {
          return true;
        }

        // Skip X-ABADR (auxiliary address data)
        if (prop.property === 'X-ABADR') {
          return true;
        }

        // Handle X-GENDER (v3.0 doesn't have standard GENDER property)
        if (prop.property === 'X-GENDER') {
          data.gender = prop.value;
          return true;
        }

        // Nametag-specific extensions
        if (prop.property === 'X-NAMETAG-SECOND-LASTNAME') {
          data.secondLastName = prop.value;

          // If surname was already parsed and contains the secondLastName, remove it
          // Example: surname = "García López", secondLastName = "López" → surname = "García"
          if (data.surname && data.surname.endsWith(' ' + prop.value)) {
            data.surname = data.surname.slice(0, -(prop.value.length + 1)).trim();
          }

          return true;
        }

        if (prop.property.startsWith('X-NAMETAG-')) {
          data.customFields.push({ key: prop.property, value: prop.value });
          return true;
        }

        // Other X- properties
        data.customFields.push({ key: prop.property, value: prop.value });
        return true;
      }

      return false; // Not handled
  }
}

/**
 * Get label from item group (e.g., item1.X-ABLabel)
 */
function getItemGroupLabel(group: string, itemGroups: ItemGroup): string | undefined {
  const groupProps = itemGroups[group];
  if (!groupProps) {
    return undefined;
  }

  const labelProp = groupProps.find((p) => p.property === 'X-ABLABEL');
  if (!labelProp) {
    return undefined;
  }

  // Decode Apple's special label format
  return decodeAppleLabel(labelProp.value);
}

/**
 * Decode Apple's special label format
 * _$!<HomePage>!$_ → Homepage
 */
function decodeAppleLabel(label: string): string {
  // Remove Apple's wrapper
  const match = label.match(/^_\$!<(.+)>!\$_$/);
  if (match) {
    return match[1];
  }

  return label;
}

/**
 * Get type from params (handles both single and array values)
 */
function getParamType(params: Record<string, string | string[]>): string | undefined {
  const typeParam = params.TYPE;
  if (!typeParam) {
    return undefined;
  }

  if (Array.isArray(typeParam)) {
    return typeParam[0];
  }

  return typeParam;
}

/**
 * Parse IMPP value (protocol:handle)
 */
function parseIMPP(value: string): { protocol: string; handle: string } | null {
  const colonIndex = value.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }

  const protocol = value.substring(0, colonIndex);
  const handle = value.substring(colonIndex + 1);

  return { protocol, handle };
}

/**
 * Parse GEO value (geo:lat,lon)
 */
function parseGEO(value: string): { latitude: number; longitude: number } | null {
  const geoMatch = value.match(/geo:([-\d.]+),([-\d.]+)/);
  if (!geoMatch) {
    return null;
  }

  return {
    latitude: parseFloat(geoMatch[1]),
    longitude: parseFloat(geoMatch[2]),
  };
}

/**
 * Parse Apple X-SOCIALPROFILE
 */
function parseSocialProfile(
  value: string,
  params: Record<string, string | string[]>
): { protocol: string; handle: string } | null {
  // X-SOCIALPROFILE can have the URL in value and type in params
  // For now, extract domain as protocol and full URL as handle
  try {
    const url = new URL(value);
    const protocol = url.hostname.replace('www.', '').split('.')[0];
    return { protocol, handle: value };
  } catch {
    // If not a valid URL, use as-is
    return { protocol: 'social', handle: value };
  }
}

/**
 * Parse vCard date (supports multiple formats)
 */
function parseVCardDate(dateStr: string, omitYearParam?: string | string[]): Date | null {
  if (!dateStr) {
    return null;
  }

  // Handle X-APPLE-OMIT-YEAR parameter
  if (omitYearParam) {
    // Use the year from the parameter as unknown year marker
    const yearMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (yearMatch) {
      const month = parseInt(yearMatch[2], 10);
      const day = parseInt(yearMatch[3], 10);
      // Use year 1604 to indicate unknown year (matches Apple convention)
      return new Date(1604, month - 1, day);
    }
  }

  // Handle --MM-DD (year omitted, v4) or --MMDD (v3)
  if (dateStr.startsWith('--')) {
    const rest = dateStr.substring(2);

    // Try --MM-DD format (v4)
    if (rest.includes('-')) {
      const parts = rest.split('-');
      if (parts.length === 2) {
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        // Use year 1604 to indicate unknown year (matches Apple convention)
        return new Date(1604, month - 1, day);
      }
    }

    // Try --MMDD format (v3)
    if (/^\d{4}$/.test(rest)) {
      const month = parseInt(rest.substring(0, 2), 10);
      const day = parseInt(rest.substring(2, 4), 10);
      // Use year 1604 to indicate unknown year (matches Apple convention)
      return new Date(1604, month - 1, day);
    }
  }

  // Handle YYYYMMDD (v3 format)
  if (/^\d{8}$/.test(dateStr)) {
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10);
    const day = parseInt(dateStr.substring(6, 8), 10);
    return new Date(year, month - 1, day);
  }

  // Handle YYYY-MM-DD or ISO 8601
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  return null;
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
 * Collect properties that weren't explicitly handled
 */
function collectUnknownProperties(
  properties: ParsedProperty[],
  handledProperties: Set<string>
): UnknownProperty[] {
  const unknown: UnknownProperty[] = [];

  for (const prop of properties) {
    if (!handledProperties.has(prop.rawLine)) {
      unknown.push({
        key: prop.property,
        value: prop.value,
        group: prop.group,
        params: prop.params,
      });
    }
  }

  return unknown;
}

/**
 * Format unknown properties for display in notes field
 */
function formatUnknownPropertiesForNotes(unknownProps: UnknownProperty[]): string {
  const lines: string[] = ['--- Unknown vCard Properties ---'];

  for (const prop of unknownProps) {
    const groupPrefix = prop.group ? `${prop.group}.` : '';
    const paramsStr = Object.entries(prop.params)
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`)
      .join(';');
    const params = paramsStr ? `;${paramsStr}` : '';

    lines.push(`${groupPrefix}${prop.key}${params}: ${prop.value}`);
  }

  return lines.join('\n');
}
