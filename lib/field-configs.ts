/**
 * Field configuration types and concrete configs for the generic FieldManager component.
 * Each config describes how a particular field type (phone, email, address, url, location,
 * custom field) should be rendered and validated.
 *
 * NOTE: This file must remain free of JSX so it can stay as a .ts file.
 * Any React-specific rendering is handled in the FieldManager component.
 */

import { countries, getCountryName } from '@/lib/countries';

// ─── Core Types ─────────────────────────────────────────────────────────────

/** A single field within a multi-field item */
export interface FieldDefinition {
  /** Key in the item object */
  key: string;
  /** HTML input type */
  inputType: 'text' | 'tel' | 'email' | 'url' | 'number' | 'textarea';
  /** Translation key for the placeholder */
  placeholderKey: string;
  /** Whether the field spans the full width instead of sharing a grid row */
  fullWidth?: boolean;
  /** Extra HTML input attributes (step, min, max, etc.) */
  inputAttrs?: Record<string, string | number>;
  /**
   * When set, this field will be rendered as a <select> element sourced from
   * the provided list of options.  Used for the address country field.
   */
  selectOptions?: Array<{ code: string; name: string }>;
}

/** A type option shown in the TypeComboBox */
export interface TypeOption {
  value: string;
  /** Translation key for the label */
  labelKey: string;
}

/**
 * The base record shape that every managed item must satisfy.
 * The `id` field is optional because new items don't have one yet.
 */
export interface BaseFieldItem {
  id?: string;
}

/**
 * Optional custom transformation applied just before a new/edited item is
 * committed to the list.  Return `null` to abort the commit.
 */
export type ItemTransformer<T extends BaseFieldItem> = (item: T) => T | null;

/** Describes how a FieldManager renders and validates one category of items */
export interface FieldConfig<T extends BaseFieldItem> {
  /** i18n namespace key under `people.form.<namespace>` */
  namespace: string;
  /** Accent colour used for the add-form border/background (Tailwind colour name) */
  accentColor: string;
  /** Tailwind classes for the type badge shown in view mode */
  badgeClasses: string;
  /** The default item used when the add form is opened */
  defaultItem: T;
  /**
   * Ordered list of fields to render in the form.
   * Single-field configs have exactly one entry.
   */
  fields: FieldDefinition[];
  /** Type options for the TypeComboBox; omit for configs without a type selector */
  typeOptions?: TypeOption[];
  /**
   * Derives the human-readable summary shown in view mode for a single item.
   * Should NOT include the type badge.
   */
  formatSummary: (item: T, t: (key: string) => string) => string;
  /**
   * Returns true when the item is valid and can be committed.
   * If omitted, the item is always considered valid.
   */
  validate?: (item: T) => boolean;
  /** When true, the key field is editable by the user (custom fields) */
  keyEditable?: boolean;
  /**
   * Called just before an item is added or saved so that the component can
   * normalise the data (e.g. upper-case the X- key).
   */
  transform?: ItemTransformer<T>;
}

// ─── Phone ───────────────────────────────────────────────────────────────────

export interface PersonPhone extends BaseFieldItem {
  type: string;
  number: string;
}

export const phoneFieldConfig: FieldConfig<PersonPhone> = {
  namespace: 'phones',
  accentColor: 'blue',
  badgeClasses: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
  defaultItem: { type: 'Mobile', number: '' },
  fields: [
    {
      key: 'number',
      inputType: 'tel',
      placeholderKey: 'numberPlaceholder',
      fullWidth: false,
    },
  ],
  typeOptions: [
    { value: 'Mobile', labelKey: 'types.mobile' },
    { value: 'Home', labelKey: 'types.home' },
    { value: 'Work', labelKey: 'types.work' },
    { value: 'Fax', labelKey: 'types.fax' },
    { value: 'Other', labelKey: 'types.other' },
  ],
  formatSummary: (item) => item.number,
  validate: (item) => item.number.trim() !== '',
};

// ─── Email ───────────────────────────────────────────────────────────────────

export interface PersonEmail extends BaseFieldItem {
  type: string;
  email: string;
}

export const emailFieldConfig: FieldConfig<PersonEmail> = {
  namespace: 'emails',
  accentColor: 'purple',
  badgeClasses: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
  defaultItem: { type: 'Personal', email: '' },
  fields: [
    {
      key: 'email',
      inputType: 'email',
      placeholderKey: 'emailPlaceholder',
      fullWidth: false,
    },
  ],
  typeOptions: [
    { value: 'Personal', labelKey: 'types.personal' },
    { value: 'Work', labelKey: 'types.work' },
    { value: 'Other', labelKey: 'types.other' },
  ],
  formatSummary: (item) => item.email,
  validate: (item) => item.email.trim() !== '',
};

// ─── Address ─────────────────────────────────────────────────────────────────

export interface PersonAddress extends BaseFieldItem {
  type: string;
  streetLine1?: string | null;
  streetLine2?: string | null;
  locality?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  notes?: string | null;
}

export const addressFieldConfig: FieldConfig<PersonAddress> = {
  namespace: 'addresses',
  accentColor: 'orange',
  badgeClasses: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
  defaultItem: {
    type: 'Home',
    streetLine1: '',
    streetLine2: '',
    locality: '',
    region: '',
    postalCode: '',
    country: '',
    notes: '',
  },
  fields: [
    {
      key: 'streetLine1',
      inputType: 'text',
      placeholderKey: 'streetLine1Placeholder',
      fullWidth: true,
    },
    {
      key: 'streetLine2',
      inputType: 'text',
      placeholderKey: 'streetLine2Placeholder',
      fullWidth: true,
    },
    {
      key: 'locality',
      inputType: 'text',
      placeholderKey: 'cityPlaceholder',
      fullWidth: false,
    },
    {
      key: 'region',
      inputType: 'text',
      placeholderKey: 'regionPlaceholder',
      fullWidth: false,
    },
    {
      key: 'postalCode',
      inputType: 'text',
      placeholderKey: 'postalCodePlaceholder',
      fullWidth: false,
    },
    {
      key: 'country',
      inputType: 'text',
      placeholderKey: 'countryPlaceholder',
      fullWidth: false,
      selectOptions: countries,
    },
    {
      key: 'notes',
      inputType: 'textarea',
      placeholderKey: 'notesPlaceholder',
      fullWidth: true,
    },
  ],
  typeOptions: [
    { value: 'Home', labelKey: 'types.home' },
    { value: 'Work', labelKey: 'types.work' },
    { value: 'Other', labelKey: 'types.other' },
  ],
  formatSummary: (item, t) => {
    const parts = [
      item.streetLine1,
      item.streetLine2,
      item.locality,
      item.region,
      item.postalCode,
      getCountryName(item.country) || item.country,
    ].filter(Boolean);
    return parts.join(', ') || t('noAddressData');
  },
  validate: (item) =>
    Boolean(
      item.streetLine1 ||
        item.streetLine2 ||
        item.locality ||
        item.region ||
        item.postalCode ||
        item.country
    ),
};

// ─── URL ─────────────────────────────────────────────────────────────────────

export interface PersonUrl extends BaseFieldItem {
  type: string;
  url: string;
}

export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export const urlFieldConfig: FieldConfig<PersonUrl> = {
  namespace: 'urls',
  accentColor: 'cyan',
  badgeClasses: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200',
  defaultItem: { type: 'Personal', url: '' },
  fields: [
    {
      key: 'url',
      inputType: 'url',
      placeholderKey: 'urlPlaceholder',
      fullWidth: false,
    },
  ],
  typeOptions: [
    { value: 'Personal', labelKey: 'types.personal' },
    { value: 'Work', labelKey: 'types.work' },
    { value: 'Other', labelKey: 'types.other' },
  ],
  formatSummary: (item) => item.url,
  validate: (item) => item.url.trim() !== '',
};

// ─── Location ────────────────────────────────────────────────────────────────

export interface PersonLocation extends BaseFieldItem {
  type: string;
  latitude: number;
  longitude: number;
  label?: string;
}

export const locationFieldConfig: FieldConfig<PersonLocation> = {
  namespace: 'locations',
  accentColor: 'emerald',
  badgeClasses: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200',
  defaultItem: { type: 'home', latitude: 0, longitude: 0, label: '' },
  fields: [
    {
      key: 'label',
      inputType: 'text',
      placeholderKey: 'labelPlaceholder',
      fullWidth: false,
    },
    {
      key: 'latitude',
      inputType: 'number',
      placeholderKey: 'latitudePlaceholder',
      fullWidth: false,
      inputAttrs: { step: '0.000001', min: '-90', max: '90' },
    },
    {
      key: 'longitude',
      inputType: 'number',
      placeholderKey: 'longitudePlaceholder',
      fullWidth: false,
      inputAttrs: { step: '0.000001', min: '-180', max: '180' },
    },
  ],
  typeOptions: [
    { value: 'home', labelKey: 'types.home' },
    { value: 'work', labelKey: 'types.work' },
    { value: 'other', labelKey: 'types.other' },
  ],
  formatSummary: (item) =>
    `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`,
  validate: (item) =>
    item.latitude >= -90 &&
    item.latitude <= 90 &&
    item.longitude >= -180 &&
    item.longitude <= 180,
  transform: (item) => ({
    ...item,
    label: item.label?.trim() || undefined,
  }),
};

// ─── Custom Field ─────────────────────────────────────────────────────────────

export interface PersonCustomField extends BaseFieldItem {
  key: string;
  value: string;
  type?: string;
}

export const CUSTOM_FIELD_PRESETS = [
  'X-SPOUSE',
  'X-MANAGER',
  'X-ASSISTANT',
  'X-TWITTER',
  'X-LINKEDIN',
  'X-FACEBOOK',
  'X-INSTAGRAM',
  'X-GITHUB',
  'X-CUSTOM',
] as const;

export const customFieldFieldConfig: FieldConfig<PersonCustomField> = {
  namespace: 'customFields',
  accentColor: 'purple',
  badgeClasses: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
  defaultItem: { key: '', value: '' },
  fields: [
    {
      key: 'value',
      inputType: 'textarea',
      placeholderKey: 'valuePlaceholder',
      fullWidth: true,
    },
  ],
  // No typeOptions — uses preset selector instead
  keyEditable: true,
  formatSummary: (item) => item.value,
  validate: (item) => item.key.trim() !== '' && item.value.trim() !== '',
  transform: (item) => {
    const rawKey = item.key.trim();
    if (!rawKey) return null;
    const key = rawKey.toUpperCase().startsWith('X-')
      ? rawKey.toUpperCase()
      : `X-${rawKey.toUpperCase()}`;
    return { ...item, key, value: item.value.trim() };
  },
};
