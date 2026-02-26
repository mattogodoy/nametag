'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import BulkDeleteModal from './BulkDeleteModal';
import BulkGroupAssignModal from './BulkGroupAssignModal';
import BulkRelationshipModal from './BulkRelationshipModal';
import type { DateFormat } from '@/lib/date-format';

interface PersonRow {
  id: string;
  name: string;
  surname: string | null;
  nickname: string | null;
  lastContact: Date | null;
  relationshipToUser: { label: string; color: string | null } | null;
  groups: Array<{ groupId: string; group: { name: string; color: string | null } }>;
  relationshipsFrom: Array<{ id: string }>;
  relationshipsTo: Array<{ id: string }>;
}

interface Group {
  id: string;
  name: string;
  color: string | null;
}

interface RelationshipType {
  id: string;
  label: string;
  color: string | null;
}

interface PeopleListClientProps {
  people: PersonRow[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  sortBy: string;
  order: string;
  dateFormat: DateFormat;
  availableGroups: Group[];
  relationshipTypes: RelationshipType[];
  formatDateFn: (date: Date | string, format: DateFormat) => string;
  translations: {
    surname: string;
    nickname: string;
    relationshipToUser: string;
    groups: string;
    lastContact: string;
    actions: string;
    indirect: string;
    orphanWarning: string;
    showing: string;
    page: string;
    of: string;
  };
  commonTranslations: {
    name: string;
    edit: string;
    view: string;
    previous: string;
    next: string;
  };
}

export default function PeopleListClient({
  people,
  totalCount,
  currentPage,
  totalPages,
  sortBy,
  order,
  dateFormat,
  availableGroups,
  relationshipTypes,
  formatDateFn,
  translations: tt,
  commonTranslations: tc,
}: PeopleListClientProps) {
  const t = useTranslations('people.bulk');
  const router = useRouter();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);

  // Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);

  // Group state (for inline creation in modal)
  const [groups, setGroups] = useState<Group[]>(availableGroups);

  const pageIds = useMemo(() => people.map((p) => p.id), [people]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 || selectAllPages;

  const effectiveCount = selectAllPages ? totalCount : selectedIds.size;

  const togglePerson = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSelectAllPages(false);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const togglePage = useCallback(() => {
    setSelectedIds((prev) => {
      if (allPageSelected) {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        setSelectAllPages(false);
        return next;
      } else {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      }
    });
  }, [allPageSelected, pageIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectAllPages(false);
  }, []);

  const handleSelectAllPages = useCallback(() => {
    setSelectAllPages(true);
    setSelectedIds(new Set(pageIds));
  }, [pageIds]);

  const selectedNames = useMemo(() => {
    if (selectAllPages) {
      return people.map((p) => p.name);
    }
    return people
      .filter((p) => selectedIds.has(p.id))
      .map((p) => p.name);
  }, [selectedIds, selectAllPages, people]);

  const handleSuccess = useCallback(() => {
    clearSelection();
    setShowDeleteModal(false);
    setShowGroupModal(false);
    setShowRelationshipModal(false);
    router.refresh();
  }, [clearSelection, router]);

  const handleDeleteSuccess = useCallback(() => {
    const count = effectiveCount;
    handleSuccess();
    toast.success(t('deleteSuccess', { count }));
  }, [effectiveCount, handleSuccess, t]);

  const handleGroupCreated = useCallback((group: Group) => {
    setGroups((prev) => [...prev, group]);
  }, []);

  const buildSortUrl = (col: string) => {
    const params = new URLSearchParams();
    params.set('sortBy', col);
    params.set('order', sortBy === col && order === 'asc' ? 'desc' : 'asc');
    params.set('page', String(currentPage));
    return `/people?${params.toString()}`;
  };

  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    if (sortBy !== 'name') params.set('sortBy', sortBy);
    if (order !== 'asc') params.set('order', order);
    return `/people?${params.toString()}`;
  };

  return (
    <>
      {/* Showing count */}
      <div className="mb-4 text-sm text-muted">
        {tt.showing}
      </div>

      {/* Select all pages banner */}
      {allPageSelected && !selectAllPages && totalCount > people.length && (
        <div className="mb-2 p-2 bg-primary/10 border border-primary/30 rounded-lg text-sm text-center">
          <button
            onClick={handleSelectAllPages}
            className="text-primary hover:underline font-medium"
          >
            {t('selectAllPages', { count: totalCount })}
          </button>
        </div>
      )}

      {selectAllPages && (
        <div className="mb-2 p-2 bg-primary/10 border border-primary/30 rounded-lg text-sm text-center">
          <span className="text-foreground font-medium">
            {t('allSelected', { count: totalCount })}
          </span>
          {' '}
          <button
            onClick={clearSelection}
            className="text-primary hover:underline"
          >
            {t('clearSelection')}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface shadow-lg rounded-lg overflow-hidden border-2 border-primary/30">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-elevated">
              <tr>
                <th className="pl-4 pr-2 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={togglePage}
                    className="w-4 h-4 text-primary bg-surface-elevated border-border rounded focus:ring-primary"
                    title={t('selectAll')}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  <Link href={buildSortUrl('name')} className="flex items-center gap-1 hover:text-foreground">
                    {tc.name}
                    {sortBy === 'name' && <span className="text-primary">{order === 'asc' ? '\u2191' : '\u2193'}</span>}
                  </Link>
                </th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  <Link href={buildSortUrl('surname')} className="flex items-center gap-1 hover:text-foreground">
                    {tt.surname}
                    {sortBy === 'surname' && <span className="text-primary">{order === 'asc' ? '\u2191' : '\u2193'}</span>}
                  </Link>
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  <Link href={buildSortUrl('nickname')} className="flex items-center gap-1 hover:text-foreground">
                    {tt.nickname}
                    {sortBy === 'nickname' && <span className="text-primary">{order === 'asc' ? '\u2191' : '\u2193'}</span>}
                  </Link>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  <Link href={buildSortUrl('relationship')} className="flex items-center gap-1 hover:text-foreground">
                    {tt.relationshipToUser}
                    {sortBy === 'relationship' && <span className="text-primary">{order === 'asc' ? '\u2191' : '\u2193'}</span>}
                  </Link>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  <Link href={buildSortUrl('group')} className="flex items-center gap-1 hover:text-foreground">
                    {tt.groups}
                    {sortBy === 'group' && <span className="text-primary">{order === 'asc' ? '\u2191' : '\u2193'}</span>}
                  </Link>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  <Link href={buildSortUrl('lastContact')} className="flex items-center gap-1 hover:text-foreground">
                    {tt.lastContact}
                    {sortBy === 'lastContact' && <span className="text-primary">{order === 'asc' ? '\u2191' : '\u2193'}</span>}
                  </Link>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                  {tt.actions}
                </th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {people.map((person) => {
                const isOrphan = !person.relationshipToUser &&
                                 person.relationshipsFrom.length === 0 &&
                                 person.relationshipsTo.length === 0;
                const isChecked = selectAllPages || selectedIds.has(person.id);

                return (
                  <tr key={person.id} className={`hover:bg-surface-elevated transition-colors ${isChecked ? 'bg-primary/5' : ''}`}>
                    <td className="pl-4 pr-2 py-4 w-10">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePerson(person.id)}
                        className="w-4 h-4 text-primary bg-surface-elevated border-border rounded focus:ring-primary"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link href={`/people/${person.id}`} className="text-primary hover:underline font-medium">
                          {person.name}
                        </Link>
                        {isOrphan && (
                          <span className="relative group cursor-help">
                            <span className="text-yellow-500">{'\u26A0\uFE0F'}</span>
                            <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-lg whitespace-normal max-w-xs z-50 shadow-lg">
                              {tt.orphanWarning}
                              <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></span>
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {person.surname || '\u2014'}
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {person.nickname ? `'${person.nickname}'` : '\u2014'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {person.relationshipToUser ? (
                        <span
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                          style={{
                            backgroundColor: person.relationshipToUser.color ? `${person.relationshipToUser.color}20` : '#E5E7EB',
                            color: person.relationshipToUser.color || '#374151',
                          }}
                        >
                          {person.relationshipToUser.label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-muted bg-surface-elevated">
                          {tt.indirect}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {person.groups.map((pg) => (
                          <span
                            key={pg.groupId}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                            style={{
                              backgroundColor: pg.group.color ? `${pg.group.color}20` : '#E5E7EB',
                              color: pg.group.color || '#374151',
                            }}
                          >
                            {pg.group.name}
                          </span>
                        ))}
                        {person.groups.length === 0 && <span className="text-sm text-muted">{'\u2014'}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {person.lastContact ? formatDateFn(new Date(person.lastContact), dateFormat) : '\u2014'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-3">
                        <Link href={`/people/${person.id}/edit`} className="text-primary hover:text-primary-dark transition-colors" title={tc.edit}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <Link href={`/people/${person.id}`} className="text-muted hover:text-foreground transition-colors" title={tc.view}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-surface px-4 py-3 border-t border-border sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                {currentPage > 1 ? (
                  <Link href={buildPageUrl(currentPage - 1)} className="relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-foreground bg-surface-elevated hover:bg-surface-elevated/80 transition-colors">
                    {tc.previous}
                  </Link>
                ) : (
                  <span className="relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-muted bg-surface cursor-not-allowed">
                    {tc.previous}
                  </span>
                )}
                {currentPage < totalPages ? (
                  <Link href={buildPageUrl(currentPage + 1)} className="ml-3 relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-foreground bg-surface-elevated hover:bg-surface-elevated/80 transition-colors">
                    {tc.next}
                  </Link>
                ) : (
                  <span className="ml-3 relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-muted bg-surface cursor-not-allowed">
                    {tc.next}
                  </span>
                )}
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-foreground">
                    {tt.page} <span className="font-medium">{currentPage}</span> {tt.of}{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    {currentPage > 1 ? (
                      <Link href={buildPageUrl(currentPage - 1)} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-border bg-surface-elevated text-sm font-medium text-foreground hover:bg-surface-elevated/80 transition-colors">
                        <span className="sr-only">{tc.previous}</span>{'\u2190'}
                      </Link>
                    ) : (
                      <span className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-border bg-surface text-sm font-medium text-muted cursor-not-allowed">
                        <span className="sr-only">{tc.previous}</span>{'\u2190'}
                      </span>
                    )}
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (currentPage <= 4) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 3) {
                        pageNum = totalPages - 6 + i;
                      } else {
                        pageNum = currentPage - 3 + i;
                      }
                      return pageNum === currentPage ? (
                        <span key={pageNum} className="relative inline-flex items-center px-4 py-2 border border-primary bg-primary/10 text-sm font-medium text-primary">
                          {pageNum}
                        </span>
                      ) : (
                        <Link key={pageNum} href={buildPageUrl(pageNum)} className="relative inline-flex items-center px-4 py-2 border border-border bg-surface-elevated text-sm font-medium text-foreground hover:bg-surface-elevated/80 transition-colors">
                          {pageNum}
                        </Link>
                      );
                    })}
                    {currentPage < totalPages ? (
                      <Link href={buildPageUrl(currentPage + 1)} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-border bg-surface-elevated text-sm font-medium text-foreground hover:bg-surface-elevated/80 transition-colors">
                        <span className="sr-only">{tc.next}</span>{'\u2192'}
                      </Link>
                    ) : (
                      <span className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-border bg-surface text-sm font-medium text-muted cursor-not-allowed">
                        <span className="sr-only">{tc.next}</span>{'\u2192'}
                      </span>
                    )}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating action bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${
          someSelected ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <div className="bg-surface shadow-2xl border-2 border-primary/30 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                {selectAllPages
                  ? t('allSelected', { count: totalCount })
                  : t('selected', { count: selectedIds.size })}
              </span>
              <button
                onClick={clearSelection}
                className="text-muted hover:text-foreground transition-colors"
                title={t('clearSelection')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGroupModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-foreground bg-surface-elevated border border-border rounded-lg hover:bg-surface-elevated/80 transition-colors"
              >
                {t('addToGroups')}
              </button>
              <button
                onClick={() => setShowRelationshipModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-foreground bg-surface-elevated border border-border rounded-lg hover:bg-surface-elevated/80 transition-colors"
              >
                {t('setRelationship')}
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <BulkDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        selectedIds={Array.from(selectedIds)}
        selectAll={selectAllPages}
        selectedNames={selectedNames}
        onSuccess={handleDeleteSuccess}
      />

      <BulkGroupAssignModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        selectedIds={Array.from(selectedIds)}
        selectAll={selectAllPages}
        totalCount={totalCount}
        availableGroups={groups}
        onSuccess={handleSuccess}
        onGroupCreated={handleGroupCreated}
      />

      <BulkRelationshipModal
        isOpen={showRelationshipModal}
        onClose={() => setShowRelationshipModal(false)}
        selectedIds={Array.from(selectedIds)}
        selectAll={selectAllPages}
        totalCount={totalCount}
        relationshipTypes={relationshipTypes}
        onSuccess={handleSuccess}
      />
    </>
  );
}
