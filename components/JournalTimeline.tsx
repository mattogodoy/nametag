'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface TimelineEntry {
  id: string;
  title: string;
  date: string;
  body: string;
  people: Array<{
    person: {
      id: string;
      name: string;
      surname: string | null;
      nickname: string | null;
    };
  }>;
}

interface JournalTimelineProps {
  entries: TimelineEntry[];
  nameOrder: string;
  locale: string;
}

interface MonthGroup {
  monthKey: string;
  label: string;
  entries: TimelineEntry[];
}

function formatPersonName(
  person: { name: string; surname: string | null; nickname: string | null },
  nameOrder: string
): string {
  const displayName = person.nickname ?? person.name;

  if (!person.surname) return displayName;

  if (nameOrder === 'EASTERN') {
    // Detect CJK characters — omit space if present
    const hasCjk = /[\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(
      person.surname + displayName
    );
    const sep = hasCjk ? '' : ' ';
    return `${person.surname}${sep}${displayName}`;
  }

  return `${displayName} ${person.surname}`;
}

function truncateBody(body: string, maxLength = 150): string {
  // Strip markdown formatting
  const stripped = body
    .replace(/#{1,6}\s+/g, '')           // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // bold
    .replace(/\*([^*]+)\*/g, '$1')       // italic
    .replace(/__([^_]+)__/g, '$1')       // bold underscores
    .replace(/_([^_]+)_/g, '$1')         // italic underscores
    .replace(/~~([^~]+)~~/g, '$1')       // strikethrough
    .replace(/`{1,3}[^`]*`{1,3}/g, '')  // inline code / code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')    // images
    .replace(/^>\s+/gm, '')              // blockquotes
    .replace(/^[-*+]\s+/gm, '')         // list items
    .replace(/^\d+\.\s+/gm, '')         // ordered list items
    .replace(/\n{2,}/g, ' ')            // multiple newlines to space
    .replace(/\n/g, ' ')                // single newlines to space
    .trim();

  if (stripped.length <= maxLength) return stripped;

  return stripped.slice(0, maxLength).trimEnd() + '…';
}

function groupByMonth(entries: TimelineEntry[], locale: string): MonthGroup[] {
  const map = new Map<string, TimelineEntry[]>();

  for (const entry of entries) {
    // Parse as local date to avoid timezone shift
    const [year, month] = entry.date.split('T')[0].split('-').map(Number);
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    const existing = map.get(monthKey);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(monthKey, [entry]);
    }
  }

  // Sort month keys descending (newest first)
  const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

  return sortedKeys.map((monthKey) => {
    const [year, month] = monthKey.split('-').map(Number);
    // Use the 1st of the month as the representative date for formatting
    const representativeDate = new Date(year, month - 1, 1);
    const label = representativeDate.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
    });

    // Entries are already sorted by the server (date desc, createdAt desc)
    // so we preserve insertion order
    const monthEntries = map.get(monthKey) ?? [];

    return { monthKey, label, entries: monthEntries };
  });
}

export default function JournalTimeline({ entries, nameOrder, locale }: JournalTimelineProps) {
  const t = useTranslations('journal');
  const groups = useMemo(() => groupByMonth(entries, locale), [entries, locale]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-medium text-foreground mb-2">{t('noEntries')}</p>
        <p className="text-sm text-muted mb-6 max-w-md mx-auto">{t('noEntriesDescription')}</p>
        <Link
          href="/journal/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-primary hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          {t('writeFirstEntry')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <section key={group.monthKey} aria-label={group.label}>
          {/* Month header */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-accent whitespace-nowrap">
              {group.label}
            </span>
            <div className="flex-1 h-px bg-border" aria-hidden="true" />
          </div>

          {/* Entries */}
          <div className="space-y-0">
            {group.entries.map((entry, index) => {
              const isLast = index === group.entries.length - 1;
              const dateOnly = entry.date.split('T')[0];
              const [year, month, day] = dateOnly.split('-').map(Number);
              const entryDate = new Date(year, month - 1, day);
              const dayNumber = entryDate.getDate();
              const weekday = entryDate.toLocaleDateString(locale, { weekday: 'short' });
              const bodyPreview = truncateBody(entry.body);

              return (
                <div key={entry.id} className="flex gap-0">
                  {/* Date column */}
                  <div className="w-12 sm:w-16 flex-shrink-0 flex flex-col items-center pt-1 pr-2 sm:pr-3">
                    <span
                      className="text-2xl font-bold text-foreground leading-none tabular-nums"
                      aria-label={entryDate.toLocaleDateString(locale, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    >
                      {dayNumber}
                    </span>
                    <span className="text-xs text-muted uppercase tracking-wide mt-0.5">
                      {weekday}
                    </span>
                  </div>

                  {/* Timeline spine */}
                  <div className="flex flex-col items-center flex-shrink-0 w-6 mr-4">
                    <div
                      className="w-2.5 h-2.5 rounded-full bg-accent ring-2 ring-surface mt-1.5 z-10 flex-shrink-0"
                      aria-hidden="true"
                    />
                    {!isLast && (
                      <div className="w-px flex-1 bg-border mt-1" aria-hidden="true" />
                    )}
                  </div>

                  {/* Entry card */}
                  <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
                    <Link href={`/journal/${entry.id}`} className="block group focus:outline-none">
                      <article className="bg-surface-elevated border border-border rounded-lg px-4 py-4 hover:border-primary/60 hover:shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary group-focus:ring-2 group-focus:ring-primary">
                        <h3 className="text-sm font-semibold text-foreground leading-snug mb-1 group-hover:text-primary transition-colors">
                          {entry.title}
                        </h3>

                        {bodyPreview && (
                          <p className="text-sm text-muted line-clamp-3 mb-2 leading-relaxed">
                            {bodyPreview}
                          </p>
                        )}

                        {entry.people.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {entry.people.map(({ person }) => (
                              <span
                                key={person.id}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                              >
                                {formatPersonName(person, nameOrder)}
                              </span>
                            ))}
                          </div>
                        )}
                      </article>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
