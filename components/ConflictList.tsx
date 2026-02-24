'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface Conflict {
  id: string;
  localVersion: string;
  remoteVersion: string;
  createdAt: Date;
  mapping: {
    person: {
      name?: string | null;
      surname?: string | null;
    };
  };
}

interface PersonData {
  name?: string | null;
  surname?: string | null;
  middleName?: string | null;
  prefix?: string | null;
  suffix?: string | null;
  secondLastName?: string | null;
  nickname?: string | null;
  organization?: string | null;
  jobTitle?: string | null;
  gender?: string | null;
  birthday?: string | null;
  anniversary?: string | null;
  photo?: string | null;
  notes?: string | null;
  phoneNumbers?: Array<{ type: string; number: string }>;
  emails?: Array<{ type: string; email: string }>;
  addresses?: Array<{
    type: string;
    streetLine1?: string | null;
    streetLine2?: string | null;
    locality?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
  }>;
  urls?: Array<{ type: string; url: string }>;
  imHandles?: Array<{ protocol: string; handle: string }>;
  locations?: Array<{ type: string; latitude: number; longitude: number }>;
  customFields?: Array<{ key: string; value: string }>;
}

interface ConflictListProps {
  conflicts: Conflict[];
}

type ScalarFieldKey = 'name' | 'surname' | 'middleName' | 'prefix' | 'suffix' |
  'secondLastName' | 'nickname' | 'organization' | 'jobTitle' | 'gender' |
  'birthday' | 'anniversary' | 'notes';

const SCALAR_FIELDS: Array<{ key: ScalarFieldKey; label: string }> = [
  { key: 'name', label: 'name' },
  { key: 'surname', label: 'surname' },
  { key: 'middleName', label: 'middleName' },
  { key: 'prefix', label: 'prefix' },
  { key: 'suffix', label: 'suffix' },
  { key: 'secondLastName', label: 'secondLastName' },
  { key: 'nickname', label: 'nickname' },
  { key: 'organization', label: 'organization' },
  { key: 'jobTitle', label: 'jobTitle' },
  { key: 'gender', label: 'gender' },
  { key: 'birthday', label: 'birthday' },
  { key: 'anniversary', label: 'anniversary' },
  { key: 'notes', label: 'notes' },
];

export default function ConflictList({ conflicts }: ConflictListProps) {
  const t = useTranslations('settings.carddav.conflicts');
  const router = useRouter();
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async (conflictId: string, resolution: string) => {
    setResolving(conflictId);
    setError(null);

    try {
      const response = await fetch(`/api/carddav/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('resolveFailed'));
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('resolveFailed'));
    } finally {
      setResolving(null);
    }
  };

  const parseVersion = (version: string): PersonData => {
    try {
      return JSON.parse(version);
    } catch {
      return {};
    }
  };

  const formatScalar = (value: string | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '';
    // Format date strings
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return value;
      }
    }
    return value;
  };

  const formatPhones = (phones?: Array<{ type: string; number: string }>): string => {
    if (!phones || phones.length === 0) return '';
    return phones.map(p => `${p.number} (${p.type})`).join(', ');
  };

  const formatEmails = (emails?: Array<{ type: string; email: string }>): string => {
    if (!emails || emails.length === 0) return '';
    return emails.map(e => `${e.email} (${e.type})`).join(', ');
  };

  const formatAddresses = (addresses?: PersonData['addresses']): string => {
    if (!addresses || addresses.length === 0) return '';
    return addresses.map(a => {
      const parts = [a.streetLine1, a.streetLine2, a.locality, a.region, a.postalCode, a.country].filter(Boolean);
      return `${parts.join(', ')} (${a.type})`;
    }).join(' | ');
  };

  const formatUrls = (urls?: Array<{ type: string; url: string }>): string => {
    if (!urls || urls.length === 0) return '';
    return urls.map(u => `${u.url} (${u.type})`).join(', ');
  };

  const formatImHandles = (handles?: Array<{ protocol: string; handle: string }>): string => {
    if (!handles || handles.length === 0) return '';
    return handles.map(h => `${h.handle} (${h.protocol})`).join(', ');
  };

  const formatLocations = (locations?: Array<{ type: string; latitude: number; longitude: number }>): string => {
    if (!locations || locations.length === 0) return '';
    return locations.map(l => `${l.latitude}, ${l.longitude} (${l.type})`).join(', ');
  };

  const formatCustomFields = (fields?: Array<{ key: string; value: string }>): string => {
    if (!fields || fields.length === 0) return '';
    return fields.map(f => `${f.key}: ${f.value}`).join(', ');
  };

  type MultiValueField = {
    label: string;
    format: (data: PersonData) => string;
  };

  const MULTI_VALUE_FIELDS: MultiValueField[] = [
    { label: 'phones', format: (d) => formatPhones(d.phoneNumbers) },
    { label: 'emails', format: (d) => formatEmails(d.emails) },
    { label: 'addresses', format: (d) => formatAddresses(d.addresses) },
    { label: 'urls', format: (d) => formatUrls(d.urls) },
    { label: 'imHandles', format: (d) => formatImHandles(d.imHandles) },
    { label: 'locations', format: (d) => formatLocations(d.locations) },
    { label: 'customFields', format: (d) => formatCustomFields(d.customFields) },
  ];

  const renderFieldRow = (
    label: string,
    localValue: string,
    remoteValue: string,
  ) => {
    // Skip rows where both sides are empty
    if (!localValue && !remoteValue) return null;

    const isDifferent = localValue !== remoteValue;

    return (
      <tr key={label} className={isDifferent ? 'bg-amber-50 dark:bg-amber-900/10' : ''}>
        <td className="px-3 py-2 text-sm font-medium text-muted whitespace-nowrap border-r border-gray-200 dark:border-gray-700">
          {t(label)}
          {isDifferent && (
            <span className="ml-1.5 inline-block w-2 h-2 bg-amber-500 rounded-full" title={t('changed')} />
          )}
        </td>
        <td className="px-3 py-2 text-sm text-foreground border-r border-gray-200 dark:border-gray-700 break-words">
          {localValue || <span className="text-gray-400">{t('empty')}</span>}
        </td>
        <td className="px-3 py-2 text-sm text-foreground break-words">
          {remoteValue || <span className="text-gray-400">{t('empty')}</span>}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {conflicts.map((conflict) => {
        const local = parseVersion(conflict.localVersion);
        const remote = parseVersion(conflict.remoteVersion);
        const isResolving = resolving === conflict.id;

        return (
          <div
            key={conflict.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-foreground">
                {conflict.mapping.person.name} {conflict.mapping.person.surname}
              </h3>
              <p className="text-sm text-muted">
                {t('conflictDetected', {
                  date: new Date(conflict.createdAt).toLocaleString(),
                })}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted uppercase border-r border-gray-200 dark:border-gray-700 w-36"></th>
                    <th className="px-3 py-2 text-left text-xs font-medium border-r border-gray-200 dark:border-gray-700 w-1/2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
                        <span className="text-blue-700 dark:text-blue-300">{t('localVersion')}</span>
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium w-1/2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
                        <span className="text-green-700 dark:text-green-300">{t('remoteVersion')}</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {SCALAR_FIELDS.map(({ key, label }) =>
                    renderFieldRow(
                      label,
                      formatScalar(local[key]),
                      formatScalar(remote[key]),
                    )
                  )}
                  {MULTI_VALUE_FIELDS.map(({ label, format }) =>
                    renderFieldRow(
                      label,
                      format(local),
                      format(remote),
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-muted mb-4">{t('chooseVersion')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleResolve(conflict.id, 'keep_local')}
                  disabled={isResolving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isResolving ? t('resolving') : t('keepLocal')}
                </button>

                <button
                  onClick={() => handleResolve(conflict.id, 'keep_remote')}
                  disabled={isResolving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isResolving ? t('resolving') : t('keepRemote')}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
