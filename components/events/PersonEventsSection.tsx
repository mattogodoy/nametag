import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
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

interface Event {
  id: string;
  title: string;
  date: string;
  people: EventPerson[];
}

interface PersonEventsSectionProps {
  events: Event[];
  dateFormat: DateFormat;
  nameOrder: NameOrder | undefined;
}

export default async function PersonEventsSection({
  events,
  dateFormat,
  nameOrder,
}: PersonEventsSectionProps) {
  const t = await getTranslations('events');

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.date) >= now);
  const past = events.filter((e) => new Date(e.date) < now).reverse();

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{t('title')}</h3>
        <Link
          href="/events/new"
          className="text-sm text-primary hover:underline"
        >
          {t('addEvent')}
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="text-muted text-sm">{t('noEventsForPerson')}</p>
      ) : (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                {t('upcoming')}
              </p>
              <div className="space-y-2">
                {upcoming.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div>
                      <p className="font-medium text-sm text-foreground">{event.title}</p>
                      <p className="text-xs text-muted">
                        {formatDate(new Date(event.date), dateFormat)}{' '}
                        {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Link href={`/events/${event.id}/edit`} className="text-xs text-primary hover:underline">
                      {t('edit')}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                {t('past')}
              </p>
              <div className="space-y-2">
                {past.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-surface-elevated border border-border rounded-lg">
                    <div>
                      <p className="font-medium text-sm text-foreground">{event.title}</p>
                      <p className="text-xs text-muted">
                        {formatDate(new Date(event.date), dateFormat)}{' '}
                        {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Link href={`/events/${event.id}/edit`} className="text-xs text-primary hover:underline">
                      {t('edit')}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
