'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import EventCard from './EventCard';
import type { DateFormat } from '@/lib/date-format';
import type { NameOrder } from '@prisma/client';

interface EventPerson {
  id: string;
  name: string;
  surname: string | null;
  nickname: string | null;
  photo: string | null;
}

interface Event {
  id: string;
  title: string;
  date: string;
  people: EventPerson[];
}

interface EventListProps {
  events: Event[];
  dateFormat: DateFormat;
  nameOrder: NameOrder | undefined;
}

export default function EventList({ events, dateFormat, nameOrder }: EventListProps) {
  const t = useTranslations('events');
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.date) >= now);
  const past = events.filter((e) => new Date(e.date) < now).reverse();

  async function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success(t('deleted'));
      router.refresh();
    } catch {
      toast.error(t('deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  }

  if (events.length === 0) {
    return (
      <p className="text-muted text-center py-8">{t('noEvents')}</p>
    );
  }

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            {t('upcoming')}
          </h2>
          <div className="space-y-3">
            {upcoming.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                dateFormat={dateFormat}
                nameOrder={nameOrder}
                onDelete={deletingId === null ? handleDelete : undefined}
              />
            ))}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            {t('past')}
          </h2>
          <div className="space-y-3">
            {past.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                dateFormat={dateFormat}
                nameOrder={nameOrder}
                onDelete={deletingId === null ? handleDelete : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
