'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

export interface DuplicateCandidateDisplay {
  personId: string;
  name: string;
  surname: string | null;
  similarity: number;
}

export interface DuplicateGroupDisplay {
  people: Array<{ id: string; name: string; surname: string | null }>;
  similarity: number;
}

interface DuplicatesListProps {
  targetPersonId?: string;
  candidates?: DuplicateCandidateDisplay[];
  groups?: DuplicateGroupDisplay[];
}

function formatName(name: string, surname: string | null): string {
  return [name, surname].filter(Boolean).join(' ');
}

function SimilarityBadge({ score }: { score: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
      {score}
    </span>
  );
}

export default function DuplicatesList({
  targetPersonId,
  candidates,
  groups,
}: DuplicatesListProps) {
  const t = useTranslations('people.duplicates');

  // Per-person mode
  if (targetPersonId && candidates) {
    if (candidates.length === 0) {
      return (
        <p className="text-sm text-muted py-4">{t('noDuplicates')}</p>
      );
    }

    return (
      <div className="space-y-3">
        {candidates.map((candidate) => (
          <div
            key={candidate.personId}
            className="flex items-center justify-between gap-3 p-4 bg-surface border border-border rounded-lg"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-semibold text-foreground truncate">
                {formatName(candidate.name, candidate.surname)}
              </span>
              <SimilarityBadge
                score={t('similarity', {
                  score: Math.round(candidate.similarity * 100),
                })}
              />
            </div>
            <Link
              href={`/people/merge?primary=${targetPersonId}&secondary=${candidate.personId}`}
              className="inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors flex-shrink-0"
            >
              {t('merge')}
            </Link>
          </div>
        ))}
      </div>
    );
  }

  // Global mode
  if (groups) {
    if (groups.length === 0) {
      return (
        <p className="text-sm text-muted py-4">{t('noDuplicates')}</p>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {t('duplicateGroups', { count: groups.length })}
        </p>

        {groups.map((group, groupIndex) => (
          <div
            key={groupIndex}
            className="bg-surface border border-border rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <SimilarityBadge
                score={t('similarity', {
                  score: Math.round(group.similarity * 100),
                })}
              />
            </div>

            <div className="space-y-2">
              {group.people.map((person, i) =>
                group.people.slice(i + 1).map((other) => (
                  <div
                    key={`${person.id}-${other.id}`}
                    className="flex items-center justify-between gap-3 p-3 bg-surface-elevated rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0 text-sm text-foreground">
                      <span className="font-medium truncate">
                        {formatName(person.name, person.surname)}
                      </span>
                      <span className="text-muted">&amp;</span>
                      <span className="font-medium truncate">
                        {formatName(other.name, other.surname)}
                      </span>
                    </div>
                    <Link
                      href={`/people/merge?primary=${person.id}&secondary=${other.id}`}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors flex-shrink-0"
                    >
                      {t('merge')}
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
