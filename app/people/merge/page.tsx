'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import PersonCompare, {
  MergeSelections,
  PersonForCompare,
} from '@/components/PersonCompare';

interface ApiRelationshipToUser {
  id: string;
  name: string;
  label: string;
  color: string | null;
}

interface ApiPersonResponse {
  person: Omit<PersonForCompare, 'relationshipToUser'> & {
    relationshipToUser: ApiRelationshipToUser | null;
  };
}

function mapApiPersonToCompare(
  apiPerson: ApiPersonResponse['person']
): PersonForCompare {
  return {
    ...apiPerson,
    relationshipToUser: apiPerson.relationshipToUser
      ? {
          id: apiPerson.relationshipToUser.id,
          name: apiPerson.relationshipToUser.label,
        }
      : null,
  };
}

function MergePageContent() {
  const t = useTranslations('people.merge');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();

  const primaryParam = searchParams.get('primary');
  const secondaryParam = searchParams.get('secondary');

  const [personA, setPersonA] = useState<PersonForCompare | null>(null);
  const [personB, setPersonB] = useState<PersonForCompare | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [selections, setSelections] = useState<MergeSelections | null>(null);

  useEffect(() => {
    if (!primaryParam || !secondaryParam) {
      setLoading(false);
      setError(t('missingParams'));
      return;
    }

    async function fetchPeople() {
      try {
        const [resA, resB] = await Promise.all([
          fetch(`/api/people/${primaryParam}`),
          fetch(`/api/people/${secondaryParam}`),
        ]);

        if (!resA.ok || !resB.ok) {
          setError(t('personNotFound'));
          setLoading(false);
          return;
        }

        const dataA: ApiPersonResponse = await resA.json();
        const dataB: ApiPersonResponse = await resB.json();

        setPersonA(mapApiPersonToCompare(dataA.person));
        setPersonB(mapApiPersonToCompare(dataB.person));
      } catch {
        setError(t('error'));
      } finally {
        setLoading(false);
      }
    }

    fetchPeople();
  }, [primaryParam, secondaryParam, t]);

  const handleSelectionsChange = useCallback(
    (newSelections: MergeSelections) => {
      setSelections(newSelections);
    },
    []
  );

  const handleMerge = async () => {
    if (!selections || !personA || !personB) return;

    setMerging(true);
    try {
      const secondaryId =
        selections.primaryId === personA.id ? personB.id : personA.id;

      const res = await fetch('/api/people/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryId: selections.primaryId,
          secondaryId,
          fieldOverrides:
            Object.keys(selections.fieldOverrides).length > 0
              ? selections.fieldOverrides
              : undefined,
        }),
      });

      if (!res.ok) {
        const data: { error?: string } = await res.json();
        throw new Error(data.error || t('error'));
      }

      toast.success(t('success'));
      router.push(`/people/${selections.primaryId}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('error');
      toast.error(message);
      setMerging(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-foreground mb-6">
          {t('title')}
        </h1>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-muted">{t('loadingContacts')}</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-800 rounded-lg p-6">
            <p className="text-red-600 dark:text-red-300">{error}</p>
            <Link
              href="/people"
              className="mt-4 inline-block text-primary hover:text-primary-dark underline"
            >
              {tCommon('back')}
            </Link>
          </div>
        )}

        {!loading && !error && personA && personB && (
          <>
            <PersonCompare
              personA={personA}
              personB={personB}
              onSelectionsChange={handleSelectionsChange}
            />

            <div className="mt-6 flex justify-end space-x-3">
              <Link
                href={`/people/${personA.id}`}
                className="px-4 py-2 border border-border text-foreground rounded-lg font-semibold hover:bg-surface transition-colors"
              >
                {t('cancel')}
              </Link>
              <button
                onClick={handleMerge}
                disabled={merging}
                className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors shadow-lg hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {merging ? t('merging') : t('confirmMerge')}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function LoadingFallback() {
  const t = useTranslations('people.merge');
  return (
    <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted">{t('loadingContacts')}</p>
        </div>
      </div>
    </main>
  );
}

export default function MergePage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<LoadingFallback />}>
        <MergePageContent />
      </Suspense>
    </div>
  );
}
