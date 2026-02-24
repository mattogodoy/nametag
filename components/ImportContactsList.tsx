'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { vCardToPerson } from '@/lib/vcard';
import CompactContactRow from './CompactContactRow';
import GroupsSelector from './GroupsSelector';

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
  isFileImport?: boolean;
}

export default function ImportContactsList({
  pendingImports,
  groups,
  isFileImport = false,
}: ImportContactsListProps) {
  const t = useTranslations('settings.carddav.import');
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [perContactGroups, setPerContactGroups] = useState<Map<string, string[]>>(new Map());
  const [availableGroups, setAvailableGroups] = useState<Group[]>(groups);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleGroupCreated = (group: Group) => {
    setAvailableGroups((prev) => {
      if (prev.some((g) => g.id === group.id)) return prev;
      return [...prev, group];
    });
  };

  const handlePerContactGroupsChange = (contactId: string, groupIds: string[]) => {
    setPerContactGroups((prev) => {
      const newMap = new Map(prev);
      if (groupIds.length === 0) {
        newMap.delete(contactId);
      } else {
        newMap.set(contactId, groupIds);
      }
      return newMap;
    });
  };

  // Detect unsaved changes
  const hasUnsavedChanges = selectedIds.size > 0 || selectedGroupIds.length > 0 || perContactGroups.size > 0;

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleCancel = () => {
    const redirectUrl = isFileImport ? '/people' : '/settings/carddav';
    if (hasUnsavedChanges) {
      if (window.confirm(t('confirmLeave'))) {
        router.push(redirectUrl);
      }
    } else {
      router.push(redirectUrl);
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      setError(t('noContactsSelected'));
      return;
    }

    setImporting(true);
    setError(null);

    try {
      // Build per-contact groups object
      const perContactGroupsObj: Record<string, string[]> = {};
      perContactGroups.forEach((groupIds, contactId) => {
        perContactGroupsObj[contactId] = groupIds;
      });

      const response = await fetch('/api/carddav/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importIds: Array.from(selectedIds),
          globalGroupIds: selectedGroupIds,
          perContactGroups: perContactGroupsObj,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('importFailed'));
      }

      const data = await response.json();

      // Redirect immediately with query params for toast notification
      const params = new URLSearchParams({
        importSuccess: 'true',
        imported: data.imported.toString(),
        skipped: data.skipped.toString(),
        errors: data.errors.toString(),
      });
      const redirectUrl = isFileImport ? '/people' : '/settings/carddav';
      router.push(`${redirectUrl}?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('importFailed'));
      setImporting(false);
    }
  };

  const parsedVCards = useMemo(
    () =>
      new Map(
        pendingImports.map((pi) => {
          try {
            return [pi.id, vCardToPerson(pi.vCardData)] as const;
          } catch {
            return [pi.id, null] as const;
          }
        })
      ),
    [pendingImports]
  );

  const allSelected = selectedIds.size === pendingImports.length;

  return (
    <div className="space-y-6">
      {/* Group Selection */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="font-semibold text-foreground mb-3">
          {t('assignToGroups')}
        </h3>
        <p className="text-sm text-muted mb-3">
          {t('assignToGroupsDescription')}
        </p>
        <GroupsSelector
          availableGroups={availableGroups}
          selectedGroupIds={selectedGroupIds}
          onChange={setSelectedGroupIds}
          onGroupCreated={handleGroupCreated}
        />
      </div>

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
          const parsed = parsedVCards.get(pendingImport.id) ?? null;
          const isSelected = selectedIds.has(pendingImport.id);
          const contactGroupIds = perContactGroups.get(pendingImport.id) || [];

          return (
            <CompactContactRow
              key={pendingImport.id}
              pendingImport={pendingImport}
              isSelected={isSelected}
              onToggle={handleToggleContact}
              availableGroups={availableGroups}
              selectedGroupIds={contactGroupIds}
              onGroupsChange={handlePerContactGroupsChange}
              onGroupCreated={handleGroupCreated}
              parsedData={parsed}
            />
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleImport}
          disabled={importing || selectedIds.size === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {importing
            ? t('importing')
            : t('importSelected', { count: selectedIds.size })}
        </button>
        <button
          onClick={handleCancel}
          disabled={importing}
          className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
