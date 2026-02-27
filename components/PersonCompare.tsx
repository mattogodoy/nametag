'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';

export interface PersonForCompare {
  id: string;
  name: string;
  surname: string | null;
  middleName: string | null;
  secondLastName: string | null;
  nickname: string | null;
  prefix: string | null;
  suffix: string | null;
  organization: string | null;
  jobTitle: string | null;
  gender: string | null;
  anniversary: string | Date | null;
  lastContact: string | Date | null;
  photo: string | null;
  notes: string | null;
  relationshipToUserId: string | null;
  relationshipToUser: { id: string; name: string } | null;
  phoneNumbers: Array<{ type: string; number: string }>;
  emails: Array<{ type: string; email: string }>;
  addresses: Array<{
    type: string;
    streetLine1?: string | null;
    streetLine2?: string | null;
    locality?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
  }>;
  urls: Array<{ type: string; url: string }>;
  imHandles: Array<{ protocol: string; handle: string }>;
  locations: Array<{ type: string; latitude: number; longitude: number }>;
  customFields: Array<{ key: string; value: string }>;
  importantDates: Array<{ title: string; date: string | Date }>;
  groups: Array<{ group: { id: string; name: string } }>;
}

export interface MergeSelections {
  primaryId: string;
  fieldOverrides: Record<string, string | null>;
}

interface PersonCompareProps {
  personA: PersonForCompare;
  personB: PersonForCompare;
  onSelectionsChange: (selections: MergeSelections) => void;
}

type ScalarFieldKey =
  | 'name'
  | 'surname'
  | 'middleName'
  | 'secondLastName'
  | 'nickname'
  | 'prefix'
  | 'suffix'
  | 'organization'
  | 'jobTitle'
  | 'gender'
  | 'anniversary'
  | 'lastContact'
  | 'photo'
  | 'notes';

interface ScalarFieldDef {
  key: ScalarFieldKey;
  labelKey: string;
}

const SCALAR_FIELDS: ScalarFieldDef[] = [
  { key: 'name', labelKey: 'fieldName' },
  { key: 'surname', labelKey: 'fieldSurname' },
  { key: 'middleName', labelKey: 'fieldMiddleName' },
  { key: 'secondLastName', labelKey: 'fieldSecondLastName' },
  { key: 'nickname', labelKey: 'fieldNickname' },
  { key: 'prefix', labelKey: 'fieldPrefix' },
  { key: 'suffix', labelKey: 'fieldSuffix' },
  { key: 'organization', labelKey: 'fieldOrganization' },
  { key: 'jobTitle', labelKey: 'fieldJobTitle' },
  { key: 'gender', labelKey: 'fieldGender' },
  { key: 'anniversary', labelKey: 'fieldAnniversary' },
  { key: 'lastContact', labelKey: 'fieldLastContact' },
  { key: 'photo', labelKey: 'fieldPhoto' },
  { key: 'notes', labelKey: 'fieldNotes' },
];

function getScalarValue(
  person: PersonForCompare,
  key: ScalarFieldKey
): string | null {
  const raw = person[key];
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) {
    return raw.toISOString().split('T')[0];
  }
  if (typeof raw === 'string' && raw.trim() === '') return null;
  return String(raw);
}

function formatDisplayValue(value: string | null, key: ScalarFieldKey): string {
  if (value === null) return '';
  if (
    (key === 'anniversary' || key === 'lastContact') &&
    /^\d{4}-\d{2}-\d{2}/.test(value)
  ) {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  }
  if (key === 'photo') {
    // For photos, just indicate presence rather than showing the full URL
    return value ? '***' : '';
  }
  return value;
}

function countNonEmptyFields(person: PersonForCompare): number {
  let count = 0;
  for (const { key } of SCALAR_FIELDS) {
    if (getScalarValue(person, key) !== null) count++;
  }
  if (person.relationshipToUserId) count++;
  count += person.phoneNumbers.length;
  count += person.emails.length;
  count += person.addresses.length;
  count += person.urls.length;
  count += person.imHandles.length;
  count += person.locations.length;
  count += person.customFields.length;
  count += person.importantDates.length;
  count += person.groups.length;
  return count;
}

function formatPersonLabel(person: PersonForCompare): string {
  return [person.name, person.surname].filter(Boolean).join(' ');
}

export default function PersonCompare({
  personA,
  personB,
  onSelectionsChange,
}: PersonCompareProps) {
  const t = useTranslations('people.merge');

  // Determine initial primary based on field count
  const initialPrimaryId = useMemo(() => {
    const countA = countNonEmptyFields(personA);
    const countB = countNonEmptyFields(personB);
    return countA >= countB ? personA.id : personB.id;
  }, [personA, personB]);

  const [primaryId, setPrimaryId] = useState(initialPrimaryId);
  const [fieldOverrides, setFieldOverrides] = useState<
    Record<string, string | null>
  >({});

  const primary = primaryId === personA.id ? personA : personB;
  const secondary = primaryId === personA.id ? personB : personA;

  // Notify parent of selection changes
  const notifyChange = useCallback(
    (newPrimaryId: string, newOverrides: Record<string, string | null>) => {
      onSelectionsChange({
        primaryId: newPrimaryId,
        fieldOverrides: newOverrides,
      });
    },
    [onSelectionsChange]
  );

  // Notify on mount and whenever selections change
  useEffect(() => {
    notifyChange(primaryId, fieldOverrides);
  }, [primaryId, fieldOverrides, notifyChange]);

  const handlePrimaryChange = (newPrimaryId: string) => {
    setPrimaryId(newPrimaryId);
    setFieldOverrides({});
  };

  const handleFieldOverride = (fieldKey: string, fromPersonId: string) => {
    setFieldOverrides((prev) => {
      const next = { ...prev };
      if (fromPersonId === primaryId) {
        // User chose primary's value, remove override
        delete next[fieldKey];
      } else {
        // User chose secondary's value, store as override
        if (fieldKey === 'relationshipToUser') {
          // For relationshipToUser, store the ID
          next[fieldKey] = secondary.relationshipToUserId;
        } else {
          next[fieldKey] = getScalarValue(
            secondary,
            fieldKey as ScalarFieldKey
          );
        }
      }
      return next;
    });
  };

  // Compute which scalar fields have conflicts (both different non-empty values)
  const scalarFieldStates = useMemo(() => {
    return SCALAR_FIELDS.map(({ key, labelKey }) => {
      const valA = getScalarValue(personA, key);
      const valB = getScalarValue(personB, key);
      const bothEmpty = valA === null && valB === null;
      const bothSame = valA === valB;
      const onlyOneHasValue =
        (valA !== null && valB === null) || (valA === null && valB !== null);
      const hasConflict =
        !bothEmpty && !bothSame && valA !== null && valB !== null;

      return {
        key,
        labelKey,
        valA,
        valB,
        bothEmpty,
        bothSame,
        onlyOneHasValue,
        hasConflict,
      };
    });
  }, [personA, personB]);

  // Relationship to user field state
  const relFieldState = useMemo(() => {
    const valA = personA.relationshipToUser?.name ?? null;
    const valB = personB.relationshipToUser?.name ?? null;
    const idA = personA.relationshipToUserId;
    const idB = personB.relationshipToUserId;
    const bothEmpty = valA === null && valB === null;
    const bothSame = idA === idB;
    const onlyOneHasValue =
      (valA !== null && valB === null) || (valA === null && valB !== null);
    const hasConflict =
      !bothEmpty && !bothSame && valA !== null && valB !== null;

    return { valA, valB, idA, idB, bothEmpty, bothSame, onlyOneHasValue, hasConflict };
  }, [personA, personB]);

  const hasAnyConflict =
    scalarFieldStates.some((f) => f.hasConflict) || relFieldState.hasConflict;

  // Multi-value field counts
  const multiValueFields = useMemo(() => {
    const fields: Array<{
      labelKey: string;
      fieldKey: string;
      countA: number;
      countB: number;
    }> = [
      {
        labelKey: 'phones',
        fieldKey: 'phoneNumbers',
        countA: personA.phoneNumbers.length,
        countB: personB.phoneNumbers.length,
      },
      {
        labelKey: 'emails',
        fieldKey: 'emails',
        countA: personA.emails.length,
        countB: personB.emails.length,
      },
      {
        labelKey: 'addresses',
        fieldKey: 'addresses',
        countA: personA.addresses.length,
        countB: personB.addresses.length,
      },
      {
        labelKey: 'urls',
        fieldKey: 'urls',
        countA: personA.urls.length,
        countB: personB.urls.length,
      },
      {
        labelKey: 'imHandles',
        fieldKey: 'imHandles',
        countA: personA.imHandles.length,
        countB: personB.imHandles.length,
      },
      {
        labelKey: 'locations',
        fieldKey: 'locations',
        countA: personA.locations.length,
        countB: personB.locations.length,
      },
      {
        labelKey: 'customFields',
        fieldKey: 'customFields',
        countA: personA.customFields.length,
        countB: personB.customFields.length,
      },
      {
        labelKey: 'importantDates',
        fieldKey: 'importantDates',
        countA: personA.importantDates.length,
        countB: personB.importantDates.length,
      },
    ];
    return fields.filter((f) => f.countA + f.countB > 0);
  }, [personA, personB]);

  // Groups count
  const groupCountA = personA.groups.length;
  const groupCountB = personB.groups.length;
  const totalGroupCount = groupCountA + groupCountB;

  return (
    <div className="space-y-6">
      {/* Primary Selection */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <p className="text-sm font-medium text-foreground mb-3">
          {t('selectPrimary')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <label
            className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors flex-1 ${
              primaryId === personA.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <input
              type="radio"
              name="primary"
              value={personA.id}
              checked={primaryId === personA.id}
              onChange={() => handlePrimaryChange(personA.id)}
              className="accent-primary"
            />
            <div>
              <span className="font-semibold text-foreground">
                {formatPersonLabel(personA)}
              </span>
              {primaryId === personA.id && (
                <span className="ml-2 text-xs font-medium text-primary">
                  {t('primary')}
                </span>
              )}
              {primaryId !== personA.id && (
                <span className="ml-2 text-xs text-muted">
                  {t('secondary')}
                </span>
              )}
            </div>
          </label>

          <label
            className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors flex-1 ${
              primaryId === personB.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <input
              type="radio"
              name="primary"
              value={personB.id}
              checked={primaryId === personB.id}
              onChange={() => handlePrimaryChange(personB.id)}
              className="accent-primary"
            />
            <div>
              <span className="font-semibold text-foreground">
                {formatPersonLabel(personB)}
              </span>
              {primaryId === personB.id && (
                <span className="ml-2 text-xs font-medium text-primary">
                  {t('primary')}
                </span>
              )}
              {primaryId !== personB.id && (
                <span className="ml-2 text-xs text-muted">
                  {t('secondary')}
                </span>
              )}
            </div>
          </label>
        </div>
      </div>

      {/* Conflicting Fields */}
      {hasAnyConflict && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="bg-surface px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              {t('conflictingFields')}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted uppercase w-40 border-r border-border" />
                  <th className="px-3 py-2 text-left text-xs font-medium border-r border-border w-1/2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          primaryId === personA.id
                            ? 'bg-primary'
                            : 'bg-gray-400'
                        }`}
                      />
                      <span
                        className={
                          primaryId === personA.id
                            ? 'text-primary font-semibold'
                            : 'text-muted'
                        }
                      >
                        {formatPersonLabel(personA)}
                        {primaryId === personA.id && (
                          <span className="ml-1 text-[10px]">
                            ({t('primary')})
                          </span>
                        )}
                      </span>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium w-1/2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          primaryId === personB.id
                            ? 'bg-primary'
                            : 'bg-gray-400'
                        }`}
                      />
                      <span
                        className={
                          primaryId === personB.id
                            ? 'text-primary font-semibold'
                            : 'text-muted'
                        }
                      >
                        {formatPersonLabel(personB)}
                        {primaryId === personB.id && (
                          <span className="ml-1 text-[10px]">
                            ({t('primary')})
                          </span>
                        )}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {scalarFieldStates
                  .filter((f) => f.hasConflict)
                  .map((field) => {
                    const selectedId =
                      field.key in fieldOverrides
                        ? secondary.id
                        : primary.id;
                    const displayA = formatDisplayValue(field.valA, field.key);
                    const displayB = formatDisplayValue(field.valB, field.key);

                    return (
                      <tr
                        key={field.key}
                        className="bg-amber-50/50 dark:bg-amber-900/5"
                      >
                        <td className="px-3 py-2 text-sm font-medium text-muted whitespace-nowrap border-r border-border">
                          {t(field.labelKey)}
                        </td>
                        <td className="px-3 py-2 text-sm border-r border-border">
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`field-${field.key}`}
                              checked={selectedId === personA.id}
                              onChange={() =>
                                handleFieldOverride(field.key, personA.id)
                              }
                              className="mt-0.5 accent-primary"
                            />
                            <span
                              className={`break-words ${
                                selectedId === personA.id
                                  ? 'text-foreground font-medium'
                                  : 'text-muted'
                              }`}
                            >
                              {field.key === 'photo' && field.valA ? (
                                <PhotoPreview
                                  src={field.valA}
                                  name={formatPersonLabel(personA)}
                                />
                              ) : (
                                displayA
                              )}
                            </span>
                          </label>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`field-${field.key}`}
                              checked={selectedId === personB.id}
                              onChange={() =>
                                handleFieldOverride(field.key, personB.id)
                              }
                              className="mt-0.5 accent-primary"
                            />
                            <span
                              className={`break-words ${
                                selectedId === personB.id
                                  ? 'text-foreground font-medium'
                                  : 'text-muted'
                              }`}
                            >
                              {field.key === 'photo' && field.valB ? (
                                <PhotoPreview
                                  src={field.valB}
                                  name={formatPersonLabel(personB)}
                                />
                              ) : (
                                displayB
                              )}
                            </span>
                          </label>
                        </td>
                      </tr>
                    );
                  })}

                {/* Relationship to User */}
                {relFieldState.hasConflict && (
                  <tr className="bg-amber-50/50 dark:bg-amber-900/5">
                    <td className="px-3 py-2 text-sm font-medium text-muted whitespace-nowrap border-r border-border">
                      {t('fieldRelationshipToUser')}
                    </td>
                    <td className="px-3 py-2 text-sm border-r border-border">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="field-relationshipToUser"
                          checked={
                            !('relationshipToUser' in fieldOverrides)
                              ? primaryId === personA.id
                              : personA.id !== primaryId
                          }
                          onChange={() =>
                            handleFieldOverride(
                              'relationshipToUser',
                              personA.id
                            )
                          }
                          className="mt-0.5 accent-primary"
                        />
                        <span
                          className={`break-words ${
                            (!('relationshipToUser' in fieldOverrides) &&
                              primaryId === personA.id) ||
                            ('relationshipToUser' in fieldOverrides &&
                              personA.id !== primaryId)
                              ? 'text-foreground font-medium'
                              : 'text-muted'
                          }`}
                        >
                          {relFieldState.valA || t('empty')}
                        </span>
                      </label>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="field-relationshipToUser"
                          checked={
                            !('relationshipToUser' in fieldOverrides)
                              ? primaryId === personB.id
                              : personB.id !== primaryId
                          }
                          onChange={() =>
                            handleFieldOverride(
                              'relationshipToUser',
                              personB.id
                            )
                          }
                          className="mt-0.5 accent-primary"
                        />
                        <span
                          className={`break-words ${
                            (!('relationshipToUser' in fieldOverrides) &&
                              primaryId === personB.id) ||
                            ('relationshipToUser' in fieldOverrides &&
                              personB.id !== primaryId)
                              ? 'text-foreground font-medium'
                              : 'text-muted'
                          }`}
                        >
                          {relFieldState.valB || t('empty')}
                        </span>
                      </label>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No conflicts message */}
      {!hasAnyConflict && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-sm text-muted">{t('noConflicts')}</p>
        </div>
      )}

      {/* Non-conflicting scalar fields (same value or only one has a value) */}
      {scalarFieldStates.some(
        (f) => !f.bothEmpty && !f.hasConflict
      ) && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {scalarFieldStates
                  .filter((f) => !f.bothEmpty && !f.hasConflict)
                  .map((field) => {
                    const displayVal = formatDisplayValue(
                      field.valA ?? field.valB,
                      field.key
                    );
                    return (
                      <tr key={field.key}>
                        <td className="px-3 py-2 text-sm font-medium text-muted whitespace-nowrap border-r border-border w-40">
                          {t(field.labelKey)}
                        </td>
                        <td className="px-3 py-2 text-sm text-foreground break-words">
                          {field.key === 'photo' && (field.valA ?? field.valB) ? (
                            <PhotoPreview
                              src={(field.valA ?? field.valB) as string}
                              name={formatPersonLabel(primary)}
                            />
                          ) : (
                            displayVal || t('empty')
                          )}
                        </td>
                      </tr>
                    );
                  })}

                {/* Non-conflicting relationship to user */}
                {!relFieldState.bothEmpty && !relFieldState.hasConflict && (
                  <tr>
                    <td className="px-3 py-2 text-sm font-medium text-muted whitespace-nowrap border-r border-border w-40">
                      {t('fieldRelationshipToUser')}
                    </td>
                    <td className="px-3 py-2 text-sm text-foreground break-words">
                      {relFieldState.valA ?? relFieldState.valB ?? t('empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Section */}
      <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t('summary')}
        </h3>

        {/* Multi-value fields combined */}
        {multiValueFields.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted mb-1.5">
              {t('willCombine')}
            </p>
            <ul className="space-y-1">
              {multiValueFields.map((field) => {
                const total = field.countA + field.countB;
                return (
                  <li key={field.fieldKey} className="text-sm text-foreground">
                    {t('multiValueNote', {
                      count: total,
                      field: t(field.labelKey),
                    })}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Groups transfer */}
        {totalGroupCount > 0 && (
          <div>
            <p className="text-xs font-medium text-muted mb-1.5">
              {t('willTransfer')}
            </p>
            <p className="text-sm text-foreground">
              {t('multiValueNote', {
                count: totalGroupCount,
                field: t('groups'),
              })}
            </p>
          </div>
        )}

        {/* Deletion warning */}
        <p className="text-xs text-muted italic">{t('willDelete')}</p>
      </div>
    </div>
  );
}

/** Small photo preview thumbnail for comparing photos side by side. */
function PhotoPreview({ src, name }: { src: string; name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="w-12 h-12 rounded-full object-cover border border-border"
    />
  );
}
