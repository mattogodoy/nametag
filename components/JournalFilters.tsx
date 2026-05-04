'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import PillSelector from '@/components/PillSelector';
import { formatFullName, formatGraphName, type NameDisplayFormat } from '@/lib/nameUtils';

interface PersonOption {
  id: string;
  name: string;
  surname: string | null;
  nickname: string | null;
}

interface PillPerson {
  id: string;
  label: string;
}

interface JournalFiltersProps {
  people: PersonOption[];
  currentPersonIds: string[];
  currentSearch?: string;
  nameOrder: 'WESTERN' | 'EASTERN';
  nameDisplayFormat?: NameDisplayFormat;
}

export default function JournalFilters({ people, currentPersonIds, currentSearch, nameOrder, nameDisplayFormat }: JournalFiltersProps) {
  const t = useTranslations('journal');
  const router = useRouter();

  const pillPeople: PillPerson[] = useMemo(
    () => people.map((p) => ({ id: p.id, label: formatGraphName(p, nameOrder, nameDisplayFormat) })),
    [people, nameOrder, nameDisplayFormat],
  );

  const dropdownPeople: PillPerson[] = useMemo(
    () => people.map((p) => ({ id: p.id, label: formatFullName(p, nameOrder) })),
    [people, nameOrder],
  );

  const selectedPeople = useMemo(
    () =>
      currentPersonIds
        .map((id) => pillPeople.find((p) => p.id === id))
        .filter((p): p is PillPerson => p !== undefined),
    [currentPersonIds, pillPeople],
  );

  function navigate(personIds: string[], search?: string) {
    const url = new URL('/journal', window.location.origin);
    if (personIds.length > 0) url.searchParams.set('person', personIds.join(','));
    if (search) url.searchParams.set('q', search);
    router.push(url.pathname + url.search);
  }

  function handleAddPerson(person: PillPerson) {
    navigate([...selectedPeople.map((p) => p.id), person.id], currentSearch);
  }

  function handleRemovePerson(personId: string) {
    navigate(
      selectedPeople.filter((p) => p.id !== personId).map((p) => p.id),
      currentSearch,
    );
  }

  return (
    <div className="space-y-3 mb-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const q = formData.get('q') as string;
          navigate(selectedPeople.map((p) => p.id), q || undefined);
        }}
      >
        <input
          type="search"
          name="q"
          key={currentSearch ?? ''}
          defaultValue={currentSearch ?? ''}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        />
      </form>
      <PillSelector
        selectedItems={selectedPeople}
        availableItems={dropdownPeople.filter((p) => !selectedPeople.some((s) => s.id === p.id))}
        onAdd={handleAddPerson}
        onRemove={handleRemovePerson}
        placeholder={t('filterByPerson')}
        showAllOnFocus
      />
    </div>
  );
}
