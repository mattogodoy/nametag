'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { vCardToPerson } from '@/lib/carddav/vcard';

interface PendingImport {
  id: string;
  uid: string;
  href: string;
  vCardData: string;
  displayName: string;
  discoveredAt: Date;
}

interface Group {
  id: string;
  name: string;
  color: string | null;
}

interface ImportContactsListProps {
  pendingImports: PendingImport[];
  groups: Group[];
}

export default function ImportContactsList({
  pendingImports,
  groups,
}: ImportContactsListProps) {
  const t = useTranslations('carddav.import');
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: number;
    errorMessages: string[];
  } | null>(null);

  const handleToggleContact = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === pendingImports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingImports.map((p) => p.id)));
    }
  };

  const handleToggleGroup = (groupId: string) => {
    if (selectedGroupIds.includes(groupId)) {
      setSelectedGroupIds(selectedGroupIds.filter((id) => id !== groupId));
    } else {
      setSelectedGroupIds([...selectedGroupIds, groupId]);
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      setError(t('noContactsSelected'));
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/carddav/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importIds: Array.from(selectedIds),
          groupIds: selectedGroupIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to import contacts');
      }

      const data = await response.json();
      setResult(data);

      // Refresh after successful import
      if (data.imported > 0) {
        setTimeout(() => {
          router.refresh();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import contacts');
    } finally {
      setImporting(false);
    }
  };

  const parseVCard = (vCardData: string) => {
    try {
      return vCardToPerson(vCardData);
    } catch {
      return null;
    }
  };

  const allSelected = selectedIds.size === pendingImports.length;

  return (
    <div className="space-y-6">
      {/* Group Selection */}
      {groups.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-3">
            {t('assignToGroups')}
          </h3>
          <p className="text-sm text-muted mb-3">
            {t('assignToGroupsDescription')}
          </p>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => handleToggleGroup(group.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedGroupIds.includes(group.id)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {group.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-lg">
          <p className="font-medium mb-2">{t('importComplete')}</p>
          <ul className="text-sm space-y-1">
            <li>✓ {t('imported', { count: result.imported })}</li>
            {result.skipped > 0 && (
              <li>⊘ {t('skipped', { count: result.skipped })}</li>
            )}
            {result.errors > 0 && (
              <li>✗ {t('errors', { count: result.errors })}</li>
            )}
          </ul>
          {result.errorMessages.length > 0 && (
            <div className="mt-2 text-sm">
              <p className="font-medium">{t('errorDetails')}:</p>
              <ul className="list-disc list-inside">
                {result.errorMessages.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Contacts List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-foreground">
              {allSelected ? t('deselectAll') : t('selectAll')}
            </span>
          </label>
          <span className="text-sm text-muted">
            {selectedIds.size} {t('selected')}
          </span>
        </div>

        {pendingImports.map((pendingImport) => {
          const parsed = parseVCard(pendingImport.vCardData);
          const isSelected = selectedIds.has(pendingImport.id);

          return (
            <div
              key={pendingImport.id}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              onClick={() => handleToggleContact(pendingImport.id)}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleContact(pendingImport.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />

                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">
                    {pendingImport.displayName}
                  </h4>

                  {parsed && (
                    <div className="mt-2 space-y-1 text-sm text-muted">
                      {parsed.organization && (
                        <p>
                          <span className="font-medium">{t('organization')}:</span>{' '}
                          {parsed.organization}
                        </p>
                      )}
                      {parsed.jobTitle && (
                        <p>
                          <span className="font-medium">{t('jobTitle')}:</span>{' '}
                          {parsed.jobTitle}
                        </p>
                      )}
                      {parsed.emails && parsed.emails.length > 0 && (
                        <p>
                          <span className="font-medium">{t('email')}:</span>{' '}
                          {parsed.emails[0].email}
                        </p>
                      )}
                      {parsed.phoneNumbers && parsed.phoneNumbers.length > 0 && (
                        <p>
                          <span className="font-medium">{t('phone')}:</span>{' '}
                          {parsed.phoneNumbers[0].number}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="mt-2 text-xs text-muted">
                    {t('discovered')}: {new Date(pendingImport.discoveredAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Import Button */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleImport}
          disabled={importing || selectedIds.size === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {importing
            ? t('importing')
            : t('importSelected', { count: selectedIds.size })}
        </button>
      </div>
    </div>
  );
}
