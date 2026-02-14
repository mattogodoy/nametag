/**
 * TypeScript types for CardDAV and vCard transformation
 */

import type {
  Person,
  PersonPhone,
  PersonEmail,
  PersonAddress,
  PersonUrl,
  PersonIM,
  PersonLocation,
  PersonCustomField,
  ImportantDate,
  Relationship,
  Group,
} from '@prisma/client';

/**
 * Person with all relations loaded (for vCard export)
 */
export interface PersonWithRelations extends Person {
  phoneNumbers: PersonPhone[];
  emails: PersonEmail[];
  addresses: PersonAddress[];
  urls: PersonUrl[];
  imHandles: PersonIM[];
  locations: PersonLocation[];
  customFields: PersonCustomField[];
  importantDates: ImportantDate[];
  relationshipsFrom: (Relationship & {
    relatedPerson: Person;
  })[];
  groups: {
    group: Group;
  }[];
}

/**
 * Parsed vCard data (from server) ready for database insertion
 */
export interface ParsedVCardData {
  // Identity
  name: string;
  surname?: string;
  secondLastName?: string;
  middleName?: string;
  prefix?: string;
  suffix?: string;
  nickname?: string;
  uid?: string;

  // Professional
  organization?: string;
  jobTitle?: string;

  // Other
  photo?: string;
  gender?: string;
  notes?: string;

  // Dates
  anniversary?: Date;
  lastContact?: Date;

  // Multi-value fields
  phoneNumbers: {
    type: string;
    number: string;
  }[];
  emails: {
    type: string;
    email: string;
  }[];
  addresses: {
    type: string;
    streetLine1?: string;
    streetLine2?: string;
    locality?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  }[];
  urls: {
    type: string;
    url: string;
  }[];
  imHandles: {
    protocol: string;
    handle: string;
  }[];
  locations: {
    type: string;
    latitude: number;
    longitude: number;
  }[];

  // Important dates (from BDAY and ANNIVERSARY properties)
  importantDates: {
    title: string;
    date: Date;
  }[];

  // Groups (from CATEGORIES)
  categories: string[];

  // Custom fields (X- properties)
  customFields: {
    key: string;
    value: string;
    type?: string;
  }[];
}

/**
 * vCard builder options
 */
export interface VCardOptions {
  version?: '4.0' | '3.0'; // Default: 4.0
  includeNametag?: boolean; // Include Nametag-specific X- properties (default: true)
  includeRelationships?: boolean; // Include relationships as RELATED properties (default: true)
  stripMarkdown?: boolean; // Strip markdown from notes (default: false)
}

/**
 * CardDAV provider presets
 */
export interface CardDavProvider {
  id: string;
  name: string;
  serverUrl: string;
  help: string;
  requiresAppPassword?: boolean;
}

export const CARDDAV_PROVIDERS: Record<string, CardDavProvider> = {
  google: {
    id: 'google',
    name: 'Google Contacts',
    serverUrl: 'https://www.googleapis.com/.well-known/carddav',
    help: 'Use Gmail address and app-specific password',
    requiresAppPassword: true,
  },
  icloud: {
    id: 'icloud',
    name: 'iCloud Contacts',
    serverUrl: 'https://contacts.icloud.com/',
    help: 'Use Apple ID and app-specific password',
    requiresAppPassword: true,
  },
  outlook: {
    id: 'outlook',
    name: 'Outlook/Office 365',
    serverUrl: 'https://outlook.office365.com/',
    help: 'Use email and password',
    requiresAppPassword: false,
  },
};
