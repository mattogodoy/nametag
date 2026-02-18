'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface Person {
  id: string;
  name: string;
  surname: string | null;
  nickname: string | null;
  organization: string | null;
  jobTitle: string | null;
  groups: Array<{
    group: {
      id: string;
      name: string;
      color: string | null;
    };
  }>;
  phoneNumbers: Array<{
    type: string;
    number: string;
  }>;
  emails: Array<{
    type: string;
    email: string;
  }>;
}

interface BulkExportListProps {
  people: Person[];
}

export default function BulkExportList({ people }: BulkExportListProps) {
  const t = useTranslations('carddav.export');
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [result, setResult] = useState<{
    exported: number;
    skipped: number;
    errors: number;
    errorMessages: string[];
  } | null>(null);

  const handleTogglePerson = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === people.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(people.map((p) => p.id)));
    }
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) {
      setError(t('noContactsSelected'));
      return;
    }

    setExporting(true);
    setError(null);
    setResult(null);
    setProgress({ current: 0, total: selectedIds.size });

    try {
      const response = await fetch('/api/carddav/export-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personIds: Array.from(selectedIds),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('exportFailed'));
      }

      const data = await response.json();
      setResult(data);
      setProgress(null);

      // Refresh after successful export
      if (data.exported > 0) {
        setTimeout(() => {
          router.refresh();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('exportFailed'));
      setProgress(null);
    } finally {
      setExporting(false);
    }
  };

  const allSelected = selectedIds.size === people.length;

  return (
    <div className="space-y-6">
      {/* Progress */}
      {progress && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-lg">
          <p className="font-medium mb-2">{t('exporting')}</p>
          <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
          <p className="text-sm mt-2">
            {progress.current} / {progress.total}
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-lg">
          <p className="font-medium mb-2">{t('exportComplete')}</p>
          <ul className="text-sm space-y-1">
            <li>✓ {t('exported', { count: result.exported })}</li>
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

      {/* People List */}
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

        {people.map((person) => {
          const isSelected = selectedIds.has(person.id);
          const displayName = [person.name, person.surname].filter(Boolean).join(' ');

          return (
            <div
              key={person.id}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              onClick={() => handleTogglePerson(person.id)}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleTogglePerson(person.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />

                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">
                    {displayName}
                  </h4>

                  <div className="mt-2 space-y-1 text-sm text-muted">
                    {person.organization && (
                      <p>
                        <span className="font-medium">{t('organization')}:</span>{' '}
                        {person.organization}
                      </p>
                    )}
                    {person.jobTitle && (
                      <p>
                        <span className="font-medium">{t('jobTitle')}:</span>{' '}
                        {person.jobTitle}
                      </p>
                    )}
                    {person.emails.length > 0 && (
                      <p>
                        <span className="font-medium">{t('email')}:</span>{' '}
                        {person.emails[0].email}
                      </p>
                    )}
                    {person.phoneNumbers.length > 0 && (
                      <p>
                        <span className="font-medium">{t('phone')}:</span>{' '}
                        {person.phoneNumbers[0].number}
                      </p>
                    )}
                  </div>

                  {person.groups.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {person.groups.map((pg) => (
                        <span
                          key={pg.group.id}
                          className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                        >
                          {pg.group.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Export Button */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleExport}
          disabled={exporting || selectedIds.size === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {exporting
            ? t('exporting')
            : t('exportSelected', { count: selectedIds.size })}
        </button>
      </div>
    </div>
  );
}
