'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface JournalSectionProps {
  personId: string;
  latestEntry: {
    id: string;
    title: string;
    date: string;
    body: string;
    people: Array<{
      person: {
        id: string;
        name: string;
        surname: string | null;
      };
    }>;
  } | null;
  nameOrder: string | null | undefined;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '') // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links
    .replace(/#{1,6}\s+/g, '') // headings
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/([*_])(.*?)\1/g, '$2') // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // code
    .replace(/~~(.*?)~~/g, '$1') // strikethrough
    .replace(/^\s*[-*+]\s+/gm, '') // list items
    .replace(/^\s*\d+\.\s+/gm, '') // ordered list items
    .replace(/^\s*>\s+/gm, '') // blockquotes
    .replace(/\n+/g, ' ') // newlines to spaces
    .trim();
}

function formatPersonName(
  person: { name: string; surname: string | null },
  nameOrder: string | null | undefined
): string {
  if (nameOrder === 'last_first') {
    return [person.surname, person.name].filter(Boolean).join(' ');
  }
  return [person.name, person.surname].filter(Boolean).join(' ');
}

export default function JournalSection({
  personId,
  latestEntry,
  nameOrder,
}: JournalSectionProps) {
  const t = useTranslations('journal.personSection');

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
          {t('title')}
        </h3>
        <div className="flex items-center gap-2">
          <Link
            href={`/journal?person=${personId}`}
            className="text-xs text-primary border border-primary/30 rounded px-2 py-1 hover:bg-primary/10 transition-colors"
          >
            {t('viewAll')}
          </Link>
          <Link
            href={`/journal/new?person=${personId}`}
            className="text-xs text-primary border border-primary/30 rounded px-2 py-1 hover:bg-primary/10 transition-colors"
          >
            + {t('newEntry')}
          </Link>
        </div>
      </div>

      {latestEntry ? (
        <Link
          href={`/journal/${latestEntry.id}`}
          className="block bg-surface-elevated border border-border rounded-lg p-3 hover:border-primary/40 hover:bg-surface-elevated/80 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-sm font-medium text-foreground line-clamp-1">
              {latestEntry.title}
            </span>
            <span className="text-xs text-muted whitespace-nowrap flex-shrink-0">
              {new Date(latestEntry.date).toLocaleDateString()}
            </span>
          </div>
          <p className="text-xs text-muted line-clamp-2">
            {stripMarkdown(latestEntry.body)}
          </p>
          {latestEntry.people.filter((p) => p.person.id !== personId).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {latestEntry.people
                .filter((p) => p.person.id !== personId)
                .map((p) => (
                  <span
                    key={p.person.id}
                    className="bg-primary/10 text-primary text-[11px] px-2 py-0.5 rounded-full"
                  >
                    {formatPersonName(p.person, nameOrder)}
                  </span>
                ))}
            </div>
          )}
        </Link>
      ) : (
        <p className="text-sm text-muted">
          {t('noEntries')}{' '}
          <Link
            href={`/journal/new?person=${personId}`}
            className="text-primary hover:underline"
          >
            {t('writeOne')}
          </Link>
        </p>
      )}
    </div>
  );
}
