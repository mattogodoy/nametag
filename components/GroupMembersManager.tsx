'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import PillSelector from './PillSelector';
import PersonAvatar from './PersonPhoto';
import { formatFullName, formatGraphName, type NameDisplayFormat } from '@/lib/nameUtils';

interface Person {
  id: string;
  name: string;
  surname?: string | null;
  nickname?: string | null;
  photo?: string | null;
}

interface Member {
  id: string;
  name: string;
  surname?: string | null;
  nickname?: string | null;
  photo?: string | null;
}

interface GroupMembersManagerProps {
  groupId: string;
  groupName: string;
  currentMembers: Member[];
  availablePeople: Person[];
  nameOrder?: 'WESTERN' | 'EASTERN';
  nameDisplayFormat?: NameDisplayFormat;
}

export default function GroupMembersManager({
  groupId,
  groupName,
  currentMembers,
  availablePeople,
  nameOrder,
  nameDisplayFormat,
}: GroupMembersManagerProps) {
  const t = useTranslations('groups.members');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Build photo lookup map from both sources
  const photoMap = new Map<string, string | null>();
  for (const p of availablePeople) {
    photoMap.set(p.id, p.photo ?? null);
  }
  for (const m of currentMembers) {
    photoMap.set(m.id, m.photo ?? null);
  }

  // Transform people to PillItem format
  const pillItems = availablePeople.map((person) => ({
    id: person.id,
    label: formatFullName(person, nameOrder),
  }));

  const selectedItems = currentMembers.map((member) => ({
    id: member.id,
    label: formatGraphName(member, nameOrder, nameDisplayFormat),
  }));

  const handleAdd = async (item: { id: string; label: string }) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: item.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || t('errorAdd'));
        return;
      }

      toast.success(t('addedSuccess', { name: item.label, group: groupName }));
      router.refresh();
    } catch {
      toast.error(t('errorConnection'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (itemId: string) => {
    const member = currentMembers.find((m) => m.id === itemId);
    if (!member) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/members/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || t('errorRemove'));
        return;
      }

      toast.success(t('removedSuccess', { name: formatGraphName(member, nameOrder, nameDisplayFormat), group: groupName }));
      router.refresh();
    } catch {
      toast.error(t('errorConnection'));
    } finally {
      setIsLoading(false);
    }
  };

  const customRenderPill = (item: { id: string; label: string; color?: string | null }, onRemoveClick: () => void) => (
    <div
      key={item.id}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
    >
      <PersonAvatar personId={item.id} name={item.label} photo={photoMap.get(item.id)} size={20} />
      <span>{item.label}</span>
      <button
        type="button"
        onClick={onRemoveClick}
        disabled={isLoading}
        className="hover:bg-primary/20 rounded-full p-0.5 transition-colors disabled:opacity-50"
        aria-label={`${t('remove')} ${item.label}`}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );

  const customRenderSuggestion = (item: { id: string; label: string; color?: string | null }) => (
    <>
      <PersonAvatar personId={item.id} name={item.label} photo={photoMap.get(item.id)} size={20} />
      <span className="text-foreground">{item.label}</span>
    </>
  );

  return (
    <PillSelector
      label={t('label', { count: currentMembers.length })}
      selectedItems={selectedItems}
      availableItems={pillItems}
      onAdd={handleAdd}
      onRemove={handleRemove}
      placeholder={t('placeholder')}
      emptyMessage={t('emptyMessage')}
      helpText={t('helpText')}
      removeAriaLabel={t('remove')}
      clearAllAriaLabel={t('clearAll')}
      allSelectedMessage={t('allSelected')}
      isLoading={isLoading}
      renderPill={customRenderPill}
      renderSuggestion={customRenderSuggestion}
    />
  );
}
