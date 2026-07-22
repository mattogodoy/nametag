'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

type EntityType = 'people' | 'groups' | 'relationships' | 'relationshipTypes' | 'importantDates';

const ENTITY_TYPES: EntityType[] = ['people', 'groups', 'relationships', 'relationshipTypes', 'importantDates'];

interface DeletedPerson {
  id: string;
  name: string;
  surname: string | null;
  nickname: string | null;
  displayNameOverride: string | null;
  deletedAt: string;
}

interface DeletedGroup {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  deletedAt: string;
}

interface DeletedRelationship {
  id: string;
  deletedAt: string;
  person: { id: string; name: string; surname: string | null };
  relatedPerson: { id: string; name: string; surname: string | null };
  relationshipType: { id: string; label: string } | null;
}

interface DeletedRelationshipType {
  id: string;
  name: string;
  label: string;
  color: string | null;
  deletedAt: string;
}

interface DeletedImportantDate {
  id: string;
  title: string;
  date: string;
  deletedAt: string;
  person: { id: string; name: string; surname: string | null };
}

type DeletedItem = DeletedPerson | DeletedGroup | DeletedRelationship | DeletedRelationshipType | DeletedImportantDate;

function getDaysRemaining(deletedAt: string): number {
  const deleted = new Date(deletedAt);
  const now = new Date();
  const diffMs = deleted.getTime() + 30 * 24 * 60 * 60 * 1000 - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

function getRestoreUrl(type: EntityType, item: DeletedItem): string {
  switch (type) {
    case 'people':
      return `/api/people/${item.id}/restore`;
    case 'groups':
      return `/api/groups/${item.id}/restore`;
    case 'relationships':
      return `/api/relationships/${item.id}/restore`;
    case 'relationshipTypes':
      return `/api/relationship-types/${item.id}/restore`;
    case 'importantDates': {
      const date = item as DeletedImportantDate;
      return `/api/people/${date.person.id}/important-dates/${date.id}/restore`;
    }
  }
}

function getPermanentDeleteUrl(type: EntityType, item: DeletedItem): string {
  switch (type) {
    case 'people':
      return `/api/people/${item.id}/permanent`;
    case 'groups':
      return `/api/groups/${item.id}/permanent`;
    case 'relationships':
      return `/api/relationships/${item.id}/permanent`;
    case 'relationshipTypes':
      return `/api/relationship-types/${item.id}/permanent`;
    case 'importantDates': {
      const date = item as DeletedImportantDate;
      return `/api/people/${date.person.id}/important-dates/${date.id}/permanent`;
    }
  }
}

function formatPersonName(person: { name: string; surname: string | null }): string {
  return person.surname ? `${person.name} ${person.surname}` : person.name;
}

export default function TrashManager() {
  const t = useTranslations('settings.trash');
  const [activeTab, setActiveTab] = useState<EntityType>('people');
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [counts, setCounts] = useState<Record<EntityType, number>>({
    people: 0,
    groups: 0,
    relationships: 0,
    relationshipTypes: 0,
    importantDates: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: EntityType; item: DeletedItem } | null>(null);

  const fetchItems = useCallback(async (type: EntityType) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deleted?type=${type}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setItems(data.deleted);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCounts = useCallback(async () => {
    const results = await Promise.allSettled(
      ENTITY_TYPES.map(async (type) => {
        const response = await fetch(`/api/deleted?type=${type}`);
        if (!response.ok) return 0;
        const data = await response.json();
        return data.deleted.length;
      })
    );

    const newCounts: Record<EntityType, number> = {
      people: 0, groups: 0, relationships: 0, relationshipTypes: 0, importantDates: 0,
    };
    ENTITY_TYPES.forEach((type, i) => {
      const result = results[i];
      newCounts[type] = result.status === 'fulfilled' ? result.value : 0;
    });
    setCounts(newCounts);
  }, []);

  useEffect(() => {
    fetchItems(activeTab);
    fetchCounts();
  }, [activeTab, fetchItems, fetchCounts]);

  const handleRestore = async (type: EntityType, item: DeletedItem) => {
    setActionLoading(item.id);
    try {
      const response = await fetch(getRestoreUrl(type, item), { method: 'POST' });
      if (!response.ok) throw new Error('Failed to restore');
      toast.success(t('restoreSuccess'));
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setCounts((prev) => ({ ...prev, [type]: prev[type] - 1 }));
    } catch {
      toast.error(t('restoreError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmDelete) return;
    const { type, item } = confirmDelete;
    setActionLoading(item.id);
    try {
      const response = await fetch(getPermanentDeleteUrl(type, item), { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      toast.success(t('deleteSuccess'));
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setCounts((prev) => ({ ...prev, [type]: prev[type] - 1 }));
      setConfirmDelete(null);
    } catch {
      toast.error(t('deleteError'));
    } finally {
      setActionLoading(null);
    }
  };

  const renderItemLabel = (type: EntityType, item: DeletedItem): string => {
    switch (type) {
      case 'people': {
        const person = item as DeletedPerson;
        if (person.displayNameOverride) return person.displayNameOverride;
        if (person.nickname) {
          return person.surname
            ? `${person.name} "${person.nickname}" ${person.surname}`
            : `${person.name} "${person.nickname}"`;
        }
        return person.surname ? `${person.name} ${person.surname}` : person.name;
      }
      case 'groups':
        return (item as DeletedGroup).name;
      case 'relationships': {
        const rel = item as DeletedRelationship;
        const typeLabel = rel.relationshipType?.label ?? '?';
        return t('relationshipLabel', {
          personA: formatPersonName(rel.person),
          type: typeLabel,
          personB: formatPersonName(rel.relatedPerson),
        });
      }
      case 'relationshipTypes':
        return (item as DeletedRelationshipType).label;
      case 'importantDates': {
        const date = item as DeletedImportantDate;
        return t('importantDateLabel', {
          title: date.title,
          date: new Date(date.date).toLocaleDateString(),
          person: formatPersonName(date.person),
        });
      }
    }
  };

  const getDeletedAt = (item: DeletedItem): string => {
    return (item as { deletedAt: string }).deletedAt;
  };

  const renderColorDot = (type: EntityType, item: DeletedItem) => {
    let color: string | null = null;
    if (type === 'groups') color = (item as DeletedGroup).color;
    if (type === 'relationshipTypes') color = (item as DeletedRelationshipType).color;
    if (!color) return null;
    return (
      <span
        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
    );
  };

  const isPerson = (type: EntityType): boolean => type === 'people';

  return (
    <div>
      {/* Tabs */}
      <div className="border-b border-border mb-6 overflow-x-auto">
        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
          {ENTITY_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === type
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-foreground hover:border-border'
              }`}
            >
              {t(`tabs.${type}`)}
              {counts[type] > 0 && (
                <span className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  activeTab === type
                    ? 'bg-primary/10 text-primary'
                    : 'bg-surface-elevated text-muted'
                }`}>
                  {counts[type]}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Item list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <p className="mt-4 text-muted">{t('empty', { type: t(`emptyTypes.${activeTab}`) })}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const days = getDaysRemaining(getDeletedAt(item));
            return (
              <li key={item.id} className="flex items-center justify-between py-3 gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  {renderColorDot(activeTab, item)}
                  <span className="text-foreground truncate">
                    {renderItemLabel(activeTab, item)}
                  </span>
                  <span className={`text-xs whitespace-nowrap ${days <= 7 ? 'text-warning' : 'text-muted'}`}>
                    {days < 1 ? t('lessThanOneDay') : t('daysRemaining', { days })}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestore(activeTab, item)}
                    disabled={actionLoading === item.id}
                  >
                    {actionLoading === item.id ? t('restoring') : t('restore')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => setConfirmDelete({ type: activeTab, item })}
                    disabled={actionLoading === item.id}
                  >
                    {t('permanentDelete')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Confirmation modal */}
      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handlePermanentDelete}
        title={t('confirmDelete.title')}
        confirmText={t('confirmDelete.confirm')}
        cancelText={t('confirmDelete.cancel')}
        isLoading={!!actionLoading}
        loadingText={t('deleting')}
        variant="danger"
      >
        <p className="text-muted">
          {confirmDelete && isPerson(confirmDelete.type)
            ? t('confirmDelete.messagePerson')
            : t('confirmDelete.message')}
        </p>
      </ConfirmationModal>
    </div>
  );
}
