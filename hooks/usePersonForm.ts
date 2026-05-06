'use client';

import { useReducer, useCallback } from 'react';
import type { CustomFieldValueInput } from '@/lib/customFields/persistence';

type ReminderIntervalUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

export interface ImportantDateItem {
  id?: string;
  type?: string | null;
  title: string;
  date: string;
  reminderEnabled?: boolean;
  reminderType?: 'ONCE' | 'RECURRING' | null;
  reminderInterval?: number | null;
  reminderIntervalUnit?: ReminderIntervalUnit | null;
}

export interface PhoneNumberItem {
  id?: string;
  type: string;
  number: string;
}

export interface EmailItem {
  id?: string;
  type: string;
  email: string;
}

export interface AddressItem {
  id?: string;
  type: string;
  streetLine1?: string | null;
  streetLine2?: string | null;
  locality?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface UrlItem {
  id?: string;
  type: string;
  url: string;
}

export interface FormData {
  name: string;
  surname: string;
  middleName: string;
  secondLastName: string;
  nickname: string;
  prefix: string;
  suffix: string;
  organization: string;
  jobTitle: string;
  lastContact: string;
  notes: string;
  relationshipToUserId: string;
  groupIds: string[];
  contactReminderEnabled: boolean;
  contactReminderInterval: number;
  contactReminderIntervalUnit: ReminderIntervalUnit;
  cardDavSyncEnabled: boolean;
}

export interface PersonFormState {
  isLoading: boolean;
  error: string;
  photoPreview: string | null;
  photoRemoved: boolean;
  pendingPhotoBlob: Blob | null;
  cropImageSrc: string | null;
  showPhotoSourceModal: boolean;
  knownThroughId: string;
  knownThroughName: string;
  inheritGroups: boolean;
  showDropdown: boolean;
  formData: FormData;
  importantDates: ImportantDateItem[];
  phoneNumbers: PhoneNumberItem[];
  emails: EmailItem[];
  addresses: AddressItem[];
  urls: UrlItem[];
  customFieldValues: CustomFieldValueInput[];
}

type PersonFormAction =
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_PHOTO_PREVIEW'; payload: string | null }
  | { type: 'SET_PHOTO_REMOVED'; payload: boolean }
  | { type: 'SET_PENDING_PHOTO_BLOB'; payload: Blob | null }
  | { type: 'SET_CROP_IMAGE_SRC'; payload: string | null }
  | { type: 'SET_SHOW_PHOTO_SOURCE_MODAL'; payload: boolean }
  | { type: 'SET_KNOWN_THROUGH_ID'; payload: string }
  | { type: 'SET_KNOWN_THROUGH_NAME'; payload: string }
  | { type: 'SET_KNOWN_THROUGH'; payload: { id: string; name: string } }
  | { type: 'SET_INHERIT_GROUPS'; payload: boolean }
  | { type: 'SET_SHOW_DROPDOWN'; payload: boolean }
  | { type: 'SET_FORM_DATA'; payload: Partial<FormData> }
  | { type: 'SET_IMPORTANT_DATES'; payload: ImportantDateItem[] }
  | { type: 'SET_PHONE_NUMBERS'; payload: PhoneNumberItem[] }
  | { type: 'SET_EMAILS'; payload: EmailItem[] }
  | { type: 'SET_ADDRESSES'; payload: AddressItem[] }
  | { type: 'SET_URLS'; payload: UrlItem[] }
  | { type: 'SET_CUSTOM_FIELD_VALUES'; payload: CustomFieldValueInput[] }
  | { type: 'RESET'; payload: PersonFormState };

function reducer(state: PersonFormState, action: PersonFormAction): PersonFormState {
  switch (action.type) {
    case 'SET_IS_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_PHOTO_PREVIEW':
      return { ...state, photoPreview: action.payload };
    case 'SET_PHOTO_REMOVED':
      return { ...state, photoRemoved: action.payload };
    case 'SET_PENDING_PHOTO_BLOB':
      return { ...state, pendingPhotoBlob: action.payload };
    case 'SET_CROP_IMAGE_SRC':
      return { ...state, cropImageSrc: action.payload };
    case 'SET_SHOW_PHOTO_SOURCE_MODAL':
      return { ...state, showPhotoSourceModal: action.payload };
    case 'SET_KNOWN_THROUGH_ID':
      return { ...state, knownThroughId: action.payload };
    case 'SET_KNOWN_THROUGH_NAME':
      return { ...state, knownThroughName: action.payload };
    case 'SET_KNOWN_THROUGH':
      return { ...state, knownThroughId: action.payload.id, knownThroughName: action.payload.name };
    case 'SET_INHERIT_GROUPS':
      return { ...state, inheritGroups: action.payload };
    case 'SET_SHOW_DROPDOWN':
      return { ...state, showDropdown: action.payload };
    case 'SET_FORM_DATA':
      return { ...state, formData: { ...state.formData, ...action.payload } };
    case 'SET_IMPORTANT_DATES':
      return { ...state, importantDates: action.payload };
    case 'SET_PHONE_NUMBERS':
      return { ...state, phoneNumbers: action.payload };
    case 'SET_EMAILS':
      return { ...state, emails: action.payload };
    case 'SET_ADDRESSES':
      return { ...state, addresses: action.payload };
    case 'SET_URLS':
      return { ...state, urls: action.payload };
    case 'SET_CUSTOM_FIELD_VALUES':
      return { ...state, customFieldValues: action.payload };
    case 'RESET':
      return action.payload;
    default:
      return state;
  }
}

interface PersonProp {
  id: string;
  name: string;
  surname: string | null;
  middleName: string | null;
  secondLastName: string | null;
  nickname: string | null;
  prefix: string | null;
  suffix: string | null;
  photo?: string | null;
  organization: string | null;
  jobTitle: string | null;
  lastContact: Date | null;
  notes: string | null;
  relationshipToUserId: string | null;
  groups: Array<{ groupId: string }>;
  contactReminderEnabled?: boolean;
  contactReminderInterval?: number | null;
  contactReminderIntervalUnit?: ReminderIntervalUnit | null;
  cardDavSyncEnabled?: boolean;
  cardDavMapping?: { id: string } | null;
  importantDates?: Array<{
    id: string;
    type?: string | null;
    title: string;
    date: Date;
    reminderEnabled?: boolean;
    reminderType?: 'ONCE' | 'RECURRING' | null;
    reminderInterval?: number | null;
    reminderIntervalUnit?: ReminderIntervalUnit | null;
  }>;
  phoneNumbers?: Array<{ id?: string; type: string; number: string }>;
  emails?: Array<{ id?: string; type: string; email: string }>;
  addresses?: Array<{
    id?: string;
    type: string;
    streetLine1?: string | null;
    streetLine2?: string | null;
    locality?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
  }>;
  urls?: Array<{ id?: string; type: string; url: string }>;
  customFieldValues?: Array<{ templateId: string; value: string }>;
}

interface AvailablePerson {
  id: string;
  name: string;
  surname: string | null;
  middleName: string | null;
  secondLastName: string | null;
  nickname: string | null;
  groups: Array<{ groupId: string }>;
}

function buildInitialState(params: {
  person?: PersonProp;
  mode: 'create' | 'edit';
  initialName?: string;
  initialKnownThrough?: string;
  initialRelationshipType?: string;
  availablePeople: AvailablePerson[];
  youLabel: string;
}): PersonFormState {
  const {
    person,
    mode,
    initialName,
    initialKnownThrough,
    initialRelationshipType,
    availablePeople,
    youLabel,
  } = params;

  const initialKnownThroughPerson = initialKnownThrough
    ? availablePeople.find((p) => p.id === initialKnownThrough)
    : null;

  const knownThroughName = initialKnownThroughPerson
    ? `${initialKnownThroughPerson.name}${initialKnownThroughPerson.surname ? ' ' + initialKnownThroughPerson.surname : ''}`
    : youLabel;

  return {
    isLoading: false,
    error: '',
    photoPreview: null,
    photoRemoved: false,
    pendingPhotoBlob: null,
    cropImageSrc: null,
    showPhotoSourceModal: false,
    knownThroughId: initialKnownThrough || 'user',
    knownThroughName,
    inheritGroups: false,
    showDropdown: false,
    formData: {
      name: person?.name || initialName || '',
      surname: person?.surname || '',
      middleName: person?.middleName || '',
      secondLastName: person?.secondLastName || '',
      nickname: person?.nickname || '',
      prefix: person?.prefix || '',
      suffix: person?.suffix || '',
      organization: person?.organization || '',
      jobTitle: person?.jobTitle || '',
      lastContact: person?.lastContact
        ? new Date(person.lastContact).toISOString().split('T')[0]
        : '',
      notes: person?.notes || '',
      relationshipToUserId:
        person?.relationshipToUserId || initialRelationshipType || '',
      groupIds: person?.groups.map((g) => g.groupId) || [],
      contactReminderEnabled: person?.contactReminderEnabled || false,
      contactReminderInterval: person?.contactReminderInterval || 1,
      contactReminderIntervalUnit:
        (person?.contactReminderIntervalUnit as ReminderIntervalUnit) ||
        'MONTHS',
      cardDavSyncEnabled:
        mode === 'edit' ? (person?.cardDavSyncEnabled ?? true) : false,
    },
    importantDates:
      person?.importantDates?.map((d) => ({
        id: d.id,
        type: d.type ?? null,
        title: d.title,
        date: new Date(d.date).toISOString().split('T')[0],
        reminderEnabled: d.reminderEnabled,
        reminderType: d.reminderType,
        reminderInterval: d.reminderInterval,
        reminderIntervalUnit: d.reminderIntervalUnit,
      })) || [],
    phoneNumbers:
      person?.phoneNumbers?.map((p) => ({
        id: p.id,
        type: p.type,
        number: p.number,
      })) || [],
    emails:
      person?.emails?.map((e) => ({
        id: e.id,
        type: e.type,
        email: e.email,
      })) || [],
    addresses:
      person?.addresses?.map((a) => ({
        id: a.id,
        type: a.type,
        streetLine1: a.streetLine1,
        streetLine2: a.streetLine2,
        locality: a.locality,
        region: a.region,
        postalCode: a.postalCode,
        country: a.country,
      })) || [],
    urls:
      person?.urls?.map((u) => ({
        id: u.id,
        type: u.type,
        url: u.url,
      })) || [],
    customFieldValues:
      person?.customFieldValues?.map((v) => ({
        templateId: v.templateId,
        value: v.value,
      })) || [],
  };
}

export function usePersonForm(params: {
  person?: PersonProp;
  mode: 'create' | 'edit';
  initialName?: string;
  initialKnownThrough?: string;
  initialRelationshipType?: string;
  availablePeople: AvailablePerson[];
  youLabel: string;
}) {
  const initialState = buildInitialState(params);
  const [state, dispatch] = useReducer(reducer, initialState);

  const setIsLoading = useCallback(
    (val: boolean) => dispatch({ type: 'SET_IS_LOADING', payload: val }),
    []
  );
  const setError = useCallback(
    (val: string) => dispatch({ type: 'SET_ERROR', payload: val }),
    []
  );
  const setPhotoPreview = useCallback(
    (val: string | null) => dispatch({ type: 'SET_PHOTO_PREVIEW', payload: val }),
    []
  );
  const setPhotoRemoved = useCallback(
    (val: boolean) => dispatch({ type: 'SET_PHOTO_REMOVED', payload: val }),
    []
  );
  const setPendingPhotoBlob = useCallback(
    (val: Blob | null) =>
      dispatch({ type: 'SET_PENDING_PHOTO_BLOB', payload: val }),
    []
  );
  const setCropImageSrc = useCallback(
    (val: string | null) =>
      dispatch({ type: 'SET_CROP_IMAGE_SRC', payload: val }),
    []
  );
  const setShowPhotoSourceModal = useCallback(
    (val: boolean) =>
      dispatch({ type: 'SET_SHOW_PHOTO_SOURCE_MODAL', payload: val }),
    []
  );
  const setKnownThroughId = useCallback(
    (val: string) => dispatch({ type: 'SET_KNOWN_THROUGH_ID', payload: val }),
    []
  );
  const setKnownThroughName = useCallback(
    (val: string) =>
      dispatch({ type: 'SET_KNOWN_THROUGH_NAME', payload: val }),
    []
  );
  const setKnownThrough = useCallback(
    (id: string, name: string) =>
      dispatch({ type: 'SET_KNOWN_THROUGH', payload: { id, name } }),
    []
  );
  const setInheritGroups = useCallback(
    (val: boolean) => dispatch({ type: 'SET_INHERIT_GROUPS', payload: val }),
    []
  );
  const setShowDropdown = useCallback(
    (val: boolean) => dispatch({ type: 'SET_SHOW_DROPDOWN', payload: val }),
    []
  );
  const setFormData = useCallback(
    (val: Partial<FormData>) =>
      dispatch({ type: 'SET_FORM_DATA', payload: val }),
    []
  );
  const setImportantDates = useCallback(
    (val: ImportantDateItem[]) =>
      dispatch({ type: 'SET_IMPORTANT_DATES', payload: val }),
    []
  );
  const setPhoneNumbers = useCallback(
    (val: PhoneNumberItem[]) =>
      dispatch({ type: 'SET_PHONE_NUMBERS', payload: val }),
    []
  );
  const setEmails = useCallback(
    (val: EmailItem[]) => dispatch({ type: 'SET_EMAILS', payload: val }),
    []
  );
  const setAddresses = useCallback(
    (val: AddressItem[]) => dispatch({ type: 'SET_ADDRESSES', payload: val }),
    []
  );
  const setUrls = useCallback(
    (val: UrlItem[]) => dispatch({ type: 'SET_URLS', payload: val }),
    []
  );
  const setCustomFieldValues = useCallback(
    (val: CustomFieldValueInput[]) =>
      dispatch({ type: 'SET_CUSTOM_FIELD_VALUES', payload: val }),
    []
  );
  const reset = useCallback(
    (newState: PersonFormState) =>
      dispatch({ type: 'RESET', payload: newState }),
    []
  );

  return {
    state,
    setIsLoading,
    setError,
    setPhotoPreview,
    setPhotoRemoved,
    setPendingPhotoBlob,
    setCropImageSrc,
    setShowPhotoSourceModal,
    setKnownThroughId,
    setKnownThroughName,
    setKnownThrough,
    setInheritGroups,
    setShowDropdown,
    setFormData,
    setImportantDates,
    setPhoneNumbers,
    setEmails,
    setAddresses,
    setUrls,
    setCustomFieldValues,
    reset,
  };
}
