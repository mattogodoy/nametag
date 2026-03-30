'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';

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

type DuplicatesListProps =
  | { targetPersonId: string; candidates: DuplicateCandidateDisplay[]; groups?: never; onDismiss?: (personId: string) => void }
  | { targetPersonId?: never; candidates?: never; groups: DuplicateGroupDisplay[]; onDismiss?: never };

function formatName(name: string, surname: string | null): string {
  return [name, surname].filter(Boolean).join(' ');
}

function SimilarityBadge({ score }: { score: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
      {score}
    </span>
  );
}

async function dismissPair(personAId: string, personBId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/people/duplicates/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personAId, personBId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function DuplicatesList({
  targetPersonId,
  candidates,
  groups,
  onDismiss,
}: DuplicatesListProps) {
  const t = useTranslations('people.duplicates');

  // Track dismissed pairs in global mode for immediate UI removal
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [dismissingKeys, setDismissingKeys] = useState<Set<string>>(new Set());

  const handleDismiss = async (idA: string, idB: string, pairKey: string) => {
    setDismissingKeys((prev) => new Set(prev).add(pairKey));
    const ok = await dismissPair(idA, idB);
    setDismissingKeys((prev) => {
      const next = new Set(prev);
      next.delete(pairKey);
      return next;
    });

    if (ok) {
      setDismissedKeys((prev) => new Set(prev).add(pairKey));
      toast.success(t('dismissed'));
    } else {
      toast.error(t('dismissError'));
    }
  };

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
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  if (onDismiss) onDismiss(candidate.personId);
                  dismissPair(targetPersonId, candidate.personId);
                }}
                className="inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-lg border border-border text-muted hover:bg-surface-elevated transition-colors"
              >
                {t('notDuplicate')}
              </button>
              <Link
                href={`/people/merge?primary=${targetPersonId}&secondary=${candidate.personId}`}
                className="inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
              >
                {t('merge')}
              </Link>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Global mode
  if (groups) {
    // Build visible pairs: filter out dismissed ones and collect per-group
    const visibleGroups: Array<{
      group: DuplicateGroupDisplay;
      pairs: Array<{
        person: { id: string; name: string; surname: string | null };
        other: { id: string; name: string; surname: string | null };
        key: string;
      }>;
    }> = [];

    for (const group of groups) {
      const pairs: typeof visibleGroups[number]['pairs'] = [];
      for (let i = 0; i < group.people.length; i++) {
        for (let j = i + 1; j < group.people.length; j++) {
          const key = `${group.people[i].id}-${group.people[j].id}`;
          if (!dismissedKeys.has(key)) {
            pairs.push({ person: group.people[i], other: group.people[j], key });
          }
        }
      }
      if (pairs.length > 0) {
        visibleGroups.push({ group, pairs });
      }
    }

    if (visibleGroups.length === 0) {
      return (
        <p className="text-sm text-muted py-4">{t('noDuplicates')}</p>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {t('duplicateGroups', { count: visibleGroups.length })}
        </p>

        {visibleGroups.map(({ group, pairs }) => (
          <div
            key={pairs[0].key}
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
              {pairs.map(({ person, other, key }) => (
                <div
                  key={key}
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDismiss(person.id, other.id, key)}
                      disabled={dismissingKeys.has(key)}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-lg border border-border text-muted hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('notDuplicate')}
                    </button>
                    <Link
                      href={`/people/merge?primary=${person.id}&secondary=${other.id}`}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
                    >
                      {t('merge')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
