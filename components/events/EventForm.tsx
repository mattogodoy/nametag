'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import PillSelector from '@/components/PillSelector';
import { Button } from '@/components/ui/Button';
import { formatFullName } from '@/lib/nameUtils';
import type { NameOrder } from '@prisma/client';

interface Person {
  id: string;
  name: string;
  surname: string | null;
  nickname: string | null;
}

interface EventFormProps {
  mode: 'create' | 'edit';
  availablePeople: Person[];
  nameOrder?: NameOrder;
  event?: {
    id: string;
    title: string;
    date: string; // ISO string
    people: Person[];
  };
}

function toDatetimeLocal(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventForm({ mode, availablePeople, nameOrder, event }: EventFormProps) {
  const t = useTranslations('events.form');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState(event?.title ?? '');
  const [datetimeLocal, setDatetimeLocal] = useState(
    event?.date ? toDatetimeLocal(event.date) : ''
  );
  const [selectedPeople, setSelectedPeople] = useState<{ id: string; label: string }[]>(
    event?.people.map((p) => ({
      id: p.id,
      label: formatFullName(p, nameOrder),
    })) ?? []
  );

  const pillItems = availablePeople.map((p) => ({
    id: p.id,
    label: formatFullName(p, nameOrder),
  }));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError(t('titleRequired'));
      return;
    }
    if (!datetimeLocal) {
      setError(t('dateRequired'));
      return;
    }
    if (selectedPeople.length === 0) {
      setError(t('peopleRequired'));
      return;
    }

    setIsLoading(true);
    try {
      const isoDate = new Date(datetimeLocal).toISOString();
      const payload = {
        title: title.trim(),
        date: isoDate,
        personIds: selectedPeople.map((p) => p.id),
      };

      const url = mode === 'create' ? '/api/events' : `/api/events/${event!.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('saveFailed'));
      }

      toast.success(mode === 'create' ? t('created') : t('updated'));
      router.push('/events');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">{error}</div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="event-title" className="block text-sm font-medium text-foreground mb-1">
          {t('title')}
        </label>
        <input
          id="event-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('titlePlaceholder')}
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          maxLength={200}
        />
      </div>

      {/* Date & Time */}
      <div>
        <label htmlFor="event-date" className="block text-sm font-medium text-foreground mb-1">
          {t('dateTime')}
        </label>
        <input
          id="event-date"
          type="datetime-local"
          value={datetimeLocal}
          onChange={(e) => setDatetimeLocal(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* People */}
      <div>
        <PillSelector
          label={t('people')}
          selectedItems={selectedPeople}
          availableItems={pillItems}
          onAdd={(item) => setSelectedPeople((prev) => [...prev, item])}
          onRemove={(id) => setSelectedPeople((prev) => prev.filter((p) => p.id !== id))}
          placeholder={t('peoplePlaceholder')}
          showAllOnFocus
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? t('saving') : mode === 'create' ? t('create') : t('update')}
        </Button>
        <button
          type="button"
          onClick={() => router.push('/events')}
          className="px-4 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-surface-elevated transition-colors"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
