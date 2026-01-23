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
      nickname?: string | null;
      organization?: string | null;
      jobTitle?: string | null;
      notes?: string | null;
      phoneNumbers: Array<{ type: string; number: string; isPrimary: boolean }>;
      emails: Array<{ type: string; email: string; isPrimary: boolean }>;
      addresses: Array<{
        type: string;
        street: string | null;
        locality: string | null;
        region: string | null;
        postalCode: string | null;
        country: string | null;
      }>;
    };
  };
}

interface PersonData {
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
  organization?: string | null;
  jobTitle?: string | null;
  phoneNumbers?: Array<{ type: string; number: string }>;
  emails?: Array<{ type: string; email: string }>;
  addresses?: Array<{
    type: string;
    street?: string | null;
    locality?: string | null;
    region?: string | null;
  }>;
  notes?: string | null;
}

interface ConflictListProps {
  conflicts: Conflict[];
}

export default function ConflictList({ conflicts }: ConflictListProps) {
  const t = useTranslations('carddav.conflicts');
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
        throw new Error(data.error || 'Failed to resolve conflict');
      }

      // Refresh the page to show updated list
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve conflict');
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

  const formatPhones = (phones?: Array<{ type: string; number: string }>) => {
    if (!phones || phones.length === 0) return t('none');
    return phones.map(p => `${p.number} (${p.type})`).join(', ');
  };

  const formatEmails = (emails?: Array<{ type: string; email: string }>) => {
    if (!emails || emails.length === 0) return t('none');
    return emails.map(e => `${e.email} (${e.type})`).join(', ');
  };

  const formatAddresses = (addresses?: Array<{
    type: string;
    street?: string | null;
    locality?: string | null;
    region?: string | null;
  }>) => {
    if (!addresses || addresses.length === 0) return t('none');
    return addresses.map(a => {
      const parts = [a.street, a.locality, a.region].filter(Boolean);
      return `${parts.join(', ')} (${a.type})`;
    }).join(' | ');
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

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700">
              {/* Local Version */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <h4 className="font-semibold text-foreground">{t('localVersion')}</h4>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium text-muted">{t('name')}:</span>
                    <span className="ml-2 text-foreground">
                      {local.name} {local.surname}
                    </span>
                  </div>

                  {local.nickname && (
                    <div>
                      <span className="font-medium text-muted">{t('nickname')}:</span>
                      <span className="ml-2 text-foreground">{local.nickname}</span>
                    </div>
                  )}

                  {local.organization && (
                    <div>
                      <span className="font-medium text-muted">{t('organization')}:</span>
                      <span className="ml-2 text-foreground">{local.organization}</span>
                    </div>
                  )}

                  {local.jobTitle && (
                    <div>
                      <span className="font-medium text-muted">{t('jobTitle')}:</span>
                      <span className="ml-2 text-foreground">{local.jobTitle}</span>
                    </div>
                  )}

                  <div>
                    <span className="font-medium text-muted">{t('phones')}:</span>
                    <span className="ml-2 text-foreground">
                      {formatPhones(local.phoneNumbers)}
                    </span>
                  </div>

                  <div>
                    <span className="font-medium text-muted">{t('emails')}:</span>
                    <span className="ml-2 text-foreground">
                      {formatEmails(local.emails)}
                    </span>
                  </div>

                  <div>
                    <span className="font-medium text-muted">{t('addresses')}:</span>
                    <span className="ml-2 text-foreground">
                      {formatAddresses(local.addresses)}
                    </span>
                  </div>

                  {local.notes && (
                    <div>
                      <span className="font-medium text-muted">{t('notes')}:</span>
                      <p className="ml-2 text-foreground mt-1 whitespace-pre-wrap">
                        {local.notes.substring(0, 200)}
                        {local.notes.length > 200 && '...'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Remote Version */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <h4 className="font-semibold text-foreground">{t('remoteVersion')}</h4>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium text-muted">{t('name')}:</span>
                    <span className="ml-2 text-foreground">
                      {remote.name} {remote.surname}
                    </span>
                  </div>

                  {remote.nickname && (
                    <div>
                      <span className="font-medium text-muted">{t('nickname')}:</span>
                      <span className="ml-2 text-foreground">{remote.nickname}</span>
                    </div>
                  )}

                  {remote.organization && (
                    <div>
                      <span className="font-medium text-muted">{t('organization')}:</span>
                      <span className="ml-2 text-foreground">{remote.organization}</span>
                    </div>
                  )}

                  {remote.jobTitle && (
                    <div>
                      <span className="font-medium text-muted">{t('jobTitle')}:</span>
                      <span className="ml-2 text-foreground">{remote.jobTitle}</span>
                    </div>
                  )}

                  <div>
                    <span className="font-medium text-muted">{t('phones')}:</span>
                    <span className="ml-2 text-foreground">
                      {formatPhones(remote.phoneNumbers)}
                    </span>
                  </div>

                  <div>
                    <span className="font-medium text-muted">{t('emails')}:</span>
                    <span className="ml-2 text-foreground">
                      {formatEmails(remote.emails)}
                    </span>
                  </div>

                  <div>
                    <span className="font-medium text-muted">{t('addresses')}:</span>
                    <span className="ml-2 text-foreground">
                      {formatAddresses(remote.addresses)}
                    </span>
                  </div>

                  {remote.notes && (
                    <div>
                      <span className="font-medium text-muted">{t('notes')}:</span>
                      <p className="ml-2 text-foreground mt-1 whitespace-pre-wrap">
                        {remote.notes.substring(0, 200)}
                        {remote.notes.length > 200 && '...'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
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
