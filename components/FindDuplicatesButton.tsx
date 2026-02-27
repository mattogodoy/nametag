'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { DuplicateCandidateDisplay } from '@/components/DuplicatesList';

interface FindDuplicatesButtonProps {
  personId: string;
}

export default function FindDuplicatesButton({
  personId,
}: FindDuplicatesButtonProps) {
  const t = useTranslations('people.duplicates');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<DuplicateCandidateDisplay[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleClick = async () => {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);
    setLoading(true);
    setCandidates(null);

    try {
      const res = await fetch(`/api/people/${personId}/duplicates`);
      if (res.ok) {
        const data: { duplicates: DuplicateCandidateDisplay[] } =
          await res.json();
        setCandidates(data.duplicates);
      } else {
        setCandidates([]);
      }
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleClick}
        className="flex-1 sm:flex-none px-4 py-2 border border-border text-foreground rounded-lg font-semibold hover:bg-surface transition-colors text-center"
      >
        {t('findDuplicates')}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-lg shadow-lg z-20 p-4">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          )}

          {!loading && candidates !== null && candidates.length === 0 && (
            <p className="text-sm text-muted py-2">{t('noDuplicates')}</p>
          )}

          {!loading && candidates !== null && candidates.length > 0 && (
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <div
                  key={candidate.personId}
                  className="flex items-center justify-between gap-2 p-2 bg-surface-elevated rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-foreground truncate block">
                      {[candidate.name, candidate.surname]
                        .filter(Boolean)
                        .join(' ')}
                    </span>
                    <span className="text-xs text-muted">
                      {t('similarity', {
                        score: Math.round(candidate.similarity * 100),
                      })}
                    </span>
                  </div>
                  <Link
                    href={`/people/merge?primary=${personId}&secondary=${candidate.personId}`}
                    className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded bg-primary text-white hover:bg-primary-dark transition-colors flex-shrink-0"
                  >
                    {t('merge')}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
