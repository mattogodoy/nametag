'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatGraphName, type NameDisplayFormat } from '@/lib/nameUtils';

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
  nameDisplayFormat?: NameDisplayFormat;
  locale: string;
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

export default function JournalSection({
  personId,
  latestEntry,
  nameOrder,
  nameDisplayFormat,
  locale,
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
              {new Date(latestEntry.date).toLocaleDateString(locale)}
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
                    className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full"
                  >
                    {formatGraphName(p.person, nameOrder as 'WESTERN' | 'EASTERN' | undefined, nameDisplayFormat)}
                  </span>
                ))}
            </div>
          )}
        </Link>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">{t('noEntries')}</span>
          <Link
            href={`/journal/new?person=${personId}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border border-border text-muted hover:text-primary hover:border-primary transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            {t('writeOne')}
          </Link>
        </div>
      )}
    </div>
  );
}
