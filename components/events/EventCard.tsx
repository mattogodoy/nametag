'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatDate, type DateFormat } from '@/lib/date-format';
import { formatFullName } from '@/lib/nameUtils';
import type { NameOrder } from '@prisma/client';

interface EventPerson {
  id: string;
  name: string;
  surname: string | null;
  nickname: string | null;
  photo: string | null;
}

interface EventCardProps {
  event: {
    id: string;
    title: string;
    date: string;
    people: EventPerson[];
  };
  dateFormat: DateFormat;
  nameOrder: NameOrder | undefined;
  onDelete?: (id: string) => void;
}

export default function EventCard({ event, dateFormat, nameOrder, onDelete }: EventCardProps) {
  const t = useTranslations('events');
  const date = new Date(event.date);
  const isPast = date < new Date();

  return (
    <div className={`flex items-start justify-between p-4 rounded-lg border ${isPast ? 'border-border bg-surface-elevated' : 'border-primary/30 bg-primary/5'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPast ? 'bg-surface text-muted' : 'bg-primary/15 text-primary'}`}>
            {isPast ? t('past') : t('upcoming')}
          </span>
          <h3 className="font-semibold text-foreground truncate">{event.title}</h3>
        </div>
        <p className="text-sm text-muted mt-1">
          {formatDate(date, dateFormat)}{' '}
          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        {event.people.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {event.people.map((person) => (
              <Link
                key={person.id}
                href={`/people/${person.id}`}
                className="text-xs bg-surface text-foreground border border-border rounded-full px-2 py-0.5 hover:border-primary/50 transition-colors"
              >
                {formatFullName(person, nameOrder)}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
        <Link
          href={`/events/${event.id}/edit`}
          className="text-sm text-primary hover:underline"
        >
          {t('edit')}
        </Link>
        {onDelete && (
          <button
            onClick={() => onDelete(event.id)}
            className="text-sm text-destructive hover:underline"
          >
            {t('delete')}
          </button>
        )}
      </div>
    </div>
  );
}
