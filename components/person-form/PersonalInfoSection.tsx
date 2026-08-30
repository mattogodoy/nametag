'use client';

import { useTranslations } from 'next-intl';
import PersonAutocomplete from '../PersonAutocomplete';
import type { FormData } from '../../hooks/usePersonForm';

interface AvailablePerson {
  id: string;
  name: string;
  surname: string | null;
  middleName: string | null;
  secondLastName: string | null;
  nickname: string | null;
  groups: Array<{ groupId: string }>;
}

interface RelationshipType {
  id: string;
  label: string;
  color: string | null;
}

interface PersonalInfoSectionProps {
  mode: 'create' | 'edit';
  formData: FormData;
  onFormDataChange: (updates: Partial<FormData>) => void;
  knownThroughId: string;
  knownThroughName: string;
  onKnownThroughChange: (id: string, name: string) => void;
  peopleWithUser: AvailablePerson[];
  relationshipTypes: RelationshipType[];
  nameOrder?: 'WESTERN' | 'EASTERN';
}

const inputClass =
  'w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

import TooltipIcon from '@/components/ui/TooltipIcon';

export default function PersonalInfoSection({
  mode,
  formData,
  onFormDataChange,
  knownThroughId,
  knownThroughName,
  onKnownThroughChange,
  peopleWithUser,
  relationshipTypes,
  nameOrder,
}: PersonalInfoSectionProps) {
  const t = useTranslations('people.form');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="prefix"
            className="block text-sm font-medium text-muted mb-1"
          >
            {t('prefixLabel')}
          </label>
          <input
            type="text"
            id="prefix"
            value={formData.prefix}
            onChange={(e) => onFormDataChange({ prefix: e.target.value })}
            placeholder={t('prefixPlaceholder')}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-muted mb-1"
          >
            {t('nameRequired')}
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={(e) => onFormDataChange({ name: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="middleName"
            className="block text-sm font-medium text-muted mb-1"
          >
            {t('middleNameLabel')}
          </label>
          <input
            type="text"
            id="middleName"
            value={formData.middleName}
            onChange={(e) => onFormDataChange({ middleName: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="surname"
            className="block text-sm font-medium text-muted mb-1"
          >
            {t('surnameLabel')}
          </label>
          <input
            type="text"
            id="surname"
            value={formData.surname}
            onChange={(e) => onFormDataChange({ surname: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="secondLastName"
            className="block text-sm font-medium text-muted mb-1"
          >
            {t('secondLastNameLabel')}
          </label>
          <input
            type="text"
            id="secondLastName"
            value={formData.secondLastName}
            onChange={(e) =>
              onFormDataChange({ secondLastName: e.target.value })
            }
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="nickname"
            className="block text-sm font-medium text-muted mb-1"
          >
            {t('nicknameLabel')}
          </label>
          <input
            type="text"
            id="nickname"
            value={formData.nickname}
            onChange={(e) => onFormDataChange({ nickname: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="suffix"
            className="block text-sm font-medium text-muted mb-1"
          >
            {t('suffixLabel')}
          </label>
          <input
            type="text"
            id="suffix"
            value={formData.suffix}
            onChange={(e) => onFormDataChange({ suffix: e.target.value })}
            placeholder={t('suffixPlaceholder')}
            className={inputClass}
          />
        </div>

        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="displayNameOverride"
              className="block text-sm font-medium text-muted"
            >
              {t('displayNameOverrideLabel')}
            </label>
            {formData.nickname && !formData.displayNameOverride && (
              <button
                type="button"
                onClick={() =>
                  onFormDataChange({ displayNameOverride: formData.nickname })
                }
                className="text-xs text-primary hover:underline"
              >
                {t('displayNameOverrideUseNickname')}
              </button>
            )}
          </div>
          <input
            type="text"
            id="displayNameOverride"
            value={formData.displayNameOverride}
            onChange={(e) =>
              onFormDataChange({ displayNameOverride: e.target.value })
            }
            placeholder={t('displayNameOverridePlaceholder')}
            className={inputClass}
            maxLength={200}
          />
          <p className="text-xs text-muted mt-1">
            {t('displayNameOverrideHelp')}
          </p>
        </div>
      </div>

      {mode === 'create' && (
        <div>
          <label
            htmlFor="knownThrough"
            className="block text-sm font-medium text-muted mb-1"
          >
            {t('knownThroughLabel')}
          </label>
          <PersonAutocomplete
            people={peopleWithUser}
            value={knownThroughId}
            onChange={onKnownThroughChange}
            placeholder={t('searchForPerson')}
            nameOrder={nameOrder}
          />
          <p className="text-xs text-muted mt-1">{t('knownThroughHelp')}</p>
        </div>
      )}

      {mode === 'edit' && (
        <div>
          <label
            htmlFor="relationshipToUserId"
            className="flex items-center gap-1.5 text-sm font-medium text-muted mb-1"
          >
            {t('relationshipToYouDirect')}
            <TooltipIcon tooltip={t('relationshipToYouTooltip')} />
          </label>
          <select
            id="relationshipToUserId"
            value={formData.relationshipToUserId}
            onChange={(e) =>
              onFormDataChange({ relationshipToUserId: e.target.value })
            }
            className={inputClass}
          >
            <option value="">{t('selectRelationship')}</option>
            {relationshipTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === 'create' && knownThroughId === 'user' && (
        <div>
          <label
            htmlFor="relationshipToUserId"
            className="flex items-center gap-1.5 text-sm font-medium text-muted mb-1"
          >
            {t('relationshipToYouDirect')} *
            <TooltipIcon tooltip={t('relationshipToYouTooltip')} />
          </label>
          <select
            id="relationshipToUserId"
            required
            value={formData.relationshipToUserId}
            onChange={(e) =>
              onFormDataChange({ relationshipToUserId: e.target.value })
            }
            className={inputClass}
          >
            <option value="">{t('selectRelationship')}</option>
            {relationshipTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === 'create' && knownThroughId !== 'user' && (
        <div>
          <label
            htmlFor="relationshipToKnownThrough"
            className="flex items-center gap-1.5 text-sm font-medium text-muted mb-1"
          >
            {t('relationshipToRequired', { name: knownThroughName })}
            <TooltipIcon tooltip={t('relationshipToYouTooltip')} />
          </label>
          <select
            id="relationshipToKnownThrough"
            required
            value={formData.relationshipToUserId}
            onChange={(e) =>
              onFormDataChange({ relationshipToUserId: e.target.value })
            }
            className={inputClass}
          >
            <option value="">{t('selectRelationship')}</option>
            {relationshipTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted mt-1">
            {t('willBeConnectedTo', { name: knownThroughName })}
          </p>
        </div>
      )}
    </div>
  );
}
