import crypto from 'crypto';

/**
 * Build a consistent hash of person data for sync change detection.
 * All multi-value relations must be included for accurate comparison.
 */
export function buildLocalHash(person: {
  name?: string | null;
  surname?: string | null;
  middleName?: string | null;
  secondLastName?: string | null;
  prefix?: string | null;
  suffix?: string | null;
  nickname?: string | null;
  organization?: string | null;
  jobTitle?: string | null;
  gender?: string | null;
  anniversary?: Date | null;
  notes?: string | null;
  photo?: string | null;
  lastContact?: Date | null;
  phoneNumbers?: unknown[];
  emails?: unknown[];
  addresses?: unknown[];
  urls?: unknown[];
  imHandles?: unknown[];
  locations?: unknown[];
  customFields?: unknown[];
  importantDates?: unknown[];
}): string {
  const data = {
    name: person.name,
    surname: person.surname,
    middleName: person.middleName,
    secondLastName: person.secondLastName,
    prefix: person.prefix,
    suffix: person.suffix,
    nickname: person.nickname,
    organization: person.organization,
    jobTitle: person.jobTitle,
    gender: person.gender,
    anniversary: person.anniversary,
    notes: person.notes,
    photo: person.photo,
    lastContact: person.lastContact,
    phoneNumbers: person.phoneNumbers || [],
    emails: person.emails || [],
    addresses: person.addresses || [],
    urls: person.urls || [],
    imHandles: person.imHandles || [],
    locations: person.locations || [],
    customFields: person.customFields || [],
    importantDates: person.importantDates || [],
  };

  return crypto.createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}
