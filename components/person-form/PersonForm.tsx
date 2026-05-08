'use client';

import { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { usePersonForm } from '../../hooks/usePersonForm';
import FieldManager from '../fields/FieldManager';
import {
  phoneFieldConfig,
  emailFieldConfig,
  addressFieldConfig,
  urlFieldConfig,
} from '../../lib/field-configs';
import PhotoSection from './PhotoSection';
import PersonalInfoSection from './PersonalInfoSection';
import WorkInfoSection from './WorkInfoSection';
import GroupsSection from './GroupsSection';
import LastContactSection from './LastContactSection';
import ImportantDatesManager from '../ImportantDatesManager';
import MarkdownEditor from '../MarkdownEditor';
import { Button } from '../ui/Button';
import CardDavSyncSection from './CardDavSyncSection';
import CustomFieldsSection from '../customFields/CustomFieldsSection';
import type { CustomFieldTemplate } from '@prisma/client';

type ReminderIntervalUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

// These must be defined OUTSIDE the component to prevent re-renders
const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-semibold text-foreground mb-4">{children}</h3>
);

const Section = ({ children }: { children: React.ReactNode }) => (
  <div className="border border-border rounded-lg p-4">{children}</div>
);

export interface PersonFormProps {
  person?: {
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
    relationshipToUser?: {
      label: string;
    } | null;
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
    phoneNumbers?: Array<{
      id?: string;
      type: string;
      number: string;
    }>;
    emails?: Array<{
      id?: string;
      type: string;
      email: string;
    }>;
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
    urls?: Array<{
      id?: string;
      type: string;
      url: string;
    }>;
    // Only populated in edit mode; undefined on create
    customFieldValues?: Array<{
      templateId: string;
      value: string;
    }>;
  };
  customFieldTemplates?: CustomFieldTemplate[];
  groups: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
  relationshipTypes: Array<{
    id: string;
    label: string;
    color: string | null;
  }>;
  availablePeople?: Array<{
    id: string;
    name: string;
    surname: string | null;
    middleName: string | null;
    secondLastName: string | null;
    nickname: string | null;
    groups: Array<{ groupId: string }>;
  }>;
  userName?: string;
  mode: 'create' | 'edit';
  dateFormat?: 'MDY' | 'DMY' | 'YMD';
  hasCardDavConnection?: boolean;
  nameOrder?: 'WESTERN' | 'EASTERN';
  initialName?: string;
  initialKnownThrough?: string;
  initialRelationshipType?: string;
  reminderLimit?: {
    canCreate: boolean;
    current: number;
    limit: number;
    isUnlimited: boolean;
  };
}

export default function PersonForm({
  person,
  customFieldTemplates = [],
  groups,
  relationshipTypes,
  availablePeople = [],
  mode,
  dateFormat = 'MDY',
  hasCardDavConnection,
  nameOrder,
  initialName,
  initialKnownThrough,
  initialRelationshipType,
  reminderLimit,
}: PersonFormProps) {
  const t = useTranslations('people.form');
  const tPhoto = useTranslations('people.photo');
  const router = useRouter();

  const {
    state,
    setIsLoading,
    setError,
    setPhotoPreview,
    setPhotoRemoved,
    setPendingPhotoBlob,
    setCropImageSrc,
    setShowPhotoSourceModal,
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
  } = usePersonForm({
    person,
    mode,
    initialName,
    initialKnownThrough,
    initialRelationshipType,
    availablePeople,
    youLabel: t('you'),
  });

  const {
    isLoading,
    error,
    photoPreview,
    photoRemoved,
    pendingPhotoBlob,
    cropImageSrc,
    showPhotoSourceModal,
    knownThroughId,
    knownThroughName,
    inheritGroups,
    showDropdown,
    formData,
    importantDates,
    phoneNumbers,
    emails,
    addresses,
    urls,
    customFieldValues,
  } = state;

  const selectedBasePerson =
    knownThroughId !== 'user'
      ? availablePeople.find((p) => p.id === knownThroughId) ?? null
      : null;

  const handleInheritGroupsChange = (checked: boolean) => {
    setInheritGroups(checked);
    if (checked && selectedBasePerson) {
      const inheritedGroupIds = selectedBasePerson.groups.map((g) => g.groupId);
      setFormData({
        groupIds: Array.from(
          new Set([...formData.groupIds, ...inheritedGroupIds])
        ),
      });
    }
  };

  const handleKnownThroughChange = (
    newPersonId: string,
    newPersonName: string
  ) => {
    setKnownThrough(newPersonId, newPersonName);
    if (inheritGroups && newPersonId !== 'user') {
      const newBasePerson = availablePeople.find((p) => p.id === newPersonId);
      if (newBasePerson) {
        const inheritedGroupIds = newBasePerson.groups.map((g) => g.groupId);
        setFormData({
          groupIds: Array.from(
            new Set([...formData.groupIds, ...inheritedGroupIds])
          ),
        });
      }
    }
  };

  const handlePhotoSourceSelect = (file: File) => {
    setShowPhotoSourceModal(false);
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = (blob: Blob) => {
    setCropImageSrc(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    const previewUrl = URL.createObjectURL(blob);
    setPhotoPreview(previewUrl);
    setPhotoRemoved(false);
    setPendingPhotoBlob(blob);
  };

  const handlePhotoRemove = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    setPhotoRemoved(true);
    setPendingPhotoBlob(null);
  };

  const peopleWithUser = [
    { id: 'user', name: t('you'), surname: null, middleName: null, secondLastName: null, nickname: null, groups: [] },
    ...availablePeople,
  ];

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>,
    addAnother = false
  ) => {
    e.preventDefault();
    setError('');

    if (formData.lastContact) {
      const lastContactDate = new Date(formData.lastContact);
      if (lastContactDate > new Date()) {
        setError(t('errorFutureDate'));
        return;
      }
    }

    setIsLoading(true);

    try {
      const url =
        mode === 'create' ? '/api/people' : `/api/people/${person?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const payload = {
        ...formData,
        importantDates,
        phoneNumbers,
        emails,
        addresses,
        urls,
        customFieldValues,
        ...(mode === 'create' && knownThroughId !== 'user'
          ? { connectedThroughId: knownThroughId }
          : {}),
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('API Error:', data);
        if (data.details) {
          console.error('Validation errors:', data.details);
        }
        setError(data.error || t('errorSomethingWrong'));
        return;
      }

      // Apply pending photo changes (upload or delete)
      const personId = mode === 'create' ? data.person?.id : person?.id;
      if (personId) {
        if (pendingPhotoBlob) {
          try {
            const photoFormData = new FormData();
            photoFormData.append('photo', pendingPhotoBlob, 'photo.png');
            const photoRes = await fetch(`/api/people/${personId}/photo`, {
              method: 'POST',
              body: photoFormData,
            });
            if (!photoRes.ok) {
              toast.error(tPhoto('uploadError'));
            }
          } catch {
            toast.error(tPhoto('uploadError'));
          }
        } else if (photoRemoved) {
          try {
            const deleteRes = await fetch(`/api/people/${personId}/photo`, {
              method: 'DELETE',
            });
            if (!deleteRes.ok) {
              toast.error(tPhoto('removeError'));
            }
          } catch {
            toast.error(tPhoto('removeError'));
          }
        }
      }

      const displayName = `${formData.name}${formData.surname ? ' ' + formData.surname : ''}`;
      toast.success(
        mode === 'create'
          ? t('successCreated', { name: displayName })
          : t('successUpdated', { name: displayName })
      );

      if (mode === 'edit' && person?.id) {
        router.push(`/people/${person.id}`);
        router.refresh();
      } else if (mode === 'create' && addAnother) {
        const params = new URLSearchParams();
        if (initialKnownThrough) {
          params.set('knownThrough', initialKnownThrough);
        }
        if (initialRelationshipType) {
          params.set('relationshipType', initialRelationshipType);
        }
        const queryString = params.toString();
        window.location.href = queryString
          ? `/people/new?${queryString}`
          : '/people/new';
      } else if (mode === 'create' && knownThroughId !== 'user') {
        router.push(`/people/${knownThroughId}`);
        router.refresh();
      } else if (mode === 'create' && data.person?.id) {
        router.push(`/people/${data.person.id}`);
        router.refresh();
      } else {
        router.push('/people');
        router.refresh();
      }
    } catch {
      setError(t('errorSomethingWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div role="alert" className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Photo Section */}
      <PhotoSection
        personId={person?.id}
        personPhoto={person?.photo}
        personName={formData.name}
        personSurname={formData.surname}
        photoPreview={photoPreview}
        photoRemoved={photoRemoved}
        cropImageSrc={cropImageSrc}
        showPhotoSourceModal={showPhotoSourceModal}
        onShowPhotoSourceModal={setShowPhotoSourceModal}
        onPhotoSourceSelect={handlePhotoSourceSelect}
        onCropConfirm={handleCropConfirm}
        onCropCancel={() => setCropImageSrc(null)}
        onPhotoRemove={handlePhotoRemove}
      />

      {/* Personal Information Section */}
      <Section>
        <SectionHeader>{t('sectionPersonalInfo')}</SectionHeader>
        <PersonalInfoSection
          mode={mode}
          formData={formData}
          onFormDataChange={setFormData}
          knownThroughId={knownThroughId}
          knownThroughName={knownThroughName}
          onKnownThroughChange={handleKnownThroughChange}
          peopleWithUser={peopleWithUser}
          relationshipTypes={relationshipTypes}
          nameOrder={nameOrder}
          hasExistingRelationship={!!person?.relationshipToUserId}
        />
      </Section>

      {/* Work Information Section */}
      <Section>
        <SectionHeader>{t('sectionWorkInfo')}</SectionHeader>
        <WorkInfoSection formData={formData} onFormDataChange={setFormData} />
      </Section>

      {/* Custom Fields Section */}
      {customFieldTemplates.length > 0 && (
        <Section>
          <SectionHeader>{t('sectionCustomFields')}</SectionHeader>
          <CustomFieldsSection
            templates={customFieldTemplates}
            values={customFieldValues}
            onChange={setCustomFieldValues}
          />
        </Section>
      )}

      {/* Contact Information Section */}
      <Section>
        <SectionHeader>{t('sectionContactInfo')}</SectionHeader>
        <div className="space-y-4">
          <FieldManager
            items={phoneNumbers}
            onChange={setPhoneNumbers}
            fieldConfig={phoneFieldConfig}
            label={t('phones.label')}
            emptyText={t('phones.noPhones')}
          />
          <FieldManager
            items={emails}
            onChange={setEmails}
            fieldConfig={emailFieldConfig}
            label={t('emails.label')}
            emptyText={t('emails.noEmails')}
          />
        </div>
      </Section>

      {/* Location Section */}
      <Section>
        <SectionHeader>{t('sectionLocation')}</SectionHeader>
        <FieldManager
          items={addresses}
          onChange={setAddresses}
          fieldConfig={addressFieldConfig}
          label={t('addresses.label')}
          emptyText={t('addresses.noAddresses')}
        />
      </Section>

      {/* Websites Section */}
      <Section>
        <SectionHeader>{t('sectionWebsites')}</SectionHeader>
        <FieldManager
          items={urls}
          onChange={setUrls}
          fieldConfig={urlFieldConfig}
          label={t('urls.label')}
          emptyText={t('urls.noUrls')}
        />
      </Section>

      {/* Groups Section */}
      {groups.length > 0 && (
        <Section>
          <SectionHeader>{t('sectionGroups')}</SectionHeader>
          <GroupsSection
            mode={mode}
            groups={groups}
            formData={formData}
            onFormDataChange={setFormData}
            knownThroughId={knownThroughId}
            selectedBasePerson={selectedBasePerson ?? null}
            inheritGroups={inheritGroups}
            onInheritGroupsChange={handleInheritGroupsChange}
          />
        </Section>
      )}

      {/* Last Contact Section */}
      <Section>
        <SectionHeader>{t('sectionLastContact')}</SectionHeader>
        <LastContactSection
          formData={formData}
          onFormDataChange={setFormData}
          dateFormat={dateFormat}
          reminderLimit={reminderLimit}
        />
      </Section>

      {/* Important Dates Section */}
      <Section>
        <SectionHeader>{t('sectionImportantDates')}</SectionHeader>
        <ImportantDatesManager
          personId={person?.id}
          initialDates={importantDates}
          onChange={setImportantDates}
          mode={mode}
          dateFormat={dateFormat}
          reminderLimit={reminderLimit}
        />
      </Section>

      {/* Notes Section */}
      <Section>
        <SectionHeader>{t('sectionNotes')}</SectionHeader>
        <div>
          <MarkdownEditor
            id="notes"
            value={formData.notes}
            onChange={(notes) => setFormData({ notes })}
            placeholder={t('notesPlaceholder')}
            rows={4}
          />
          <p className="text-xs text-muted mt-1">{t('markdownSupport')}</p>
        </div>
      </Section>

      {/* CardDAV Sync Section */}
      {hasCardDavConnection && (
        <Section>
          <SectionHeader>{t('sectionCardDavSync')}</SectionHeader>
          <CardDavSyncSection
            mode={mode}
            formData={formData}
            onFormDataChange={setFormData}
            hasCardDavMapping={!!person?.cardDavMapping}
          />
        </Section>
      )}

      <div className="flex justify-end space-x-4 pt-4">
        <Link
          href="/people"
          className="px-6 py-2 border border-border text-muted rounded-lg font-medium hover:bg-surface-elevated transition-colors"
        >
          {t('cancel')}
        </Link>

        {mode === 'create' ? (
          <div className="relative">
            <div className="flex">
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-primary text-white rounded-l-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? t('saving') : t('create')}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setShowDropdown(!showDropdown)}
                className="px-2 py-2 bg-primary text-white border-l border-primary rounded-r-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-surface border border-border z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    setShowDropdown(false);
                    const form = e.currentTarget.closest('form');
                    if (form) {
                      if (form.checkValidity()) {
                        const submitEvent = new Event('submit', {
                          bubbles: true,
                          cancelable: true,
                        });
                        Object.defineProperty(submitEvent, 'target', {
                          value: form,
                          enumerable: true,
                        });
                        handleSubmit(
                          submitEvent as unknown as FormEvent<HTMLFormElement>,
                          true
                        );
                      } else {
                        form.reportValidity();
                      }
                    }
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-muted hover:bg-surface-elevated rounded-lg transition-colors"
                >
                  {t('createAndAddAnother')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t('saving') : t('save')}
          </Button>
        )}
      </div>
    </form>
  );
}
