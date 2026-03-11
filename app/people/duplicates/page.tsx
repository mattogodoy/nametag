'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import DuplicatesList, { DuplicateGroupDisplay } from '@/components/DuplicatesList';

export default function DuplicatesPage() {
  const t = useTranslations('people.duplicates');
  const tCommon = useTranslations('common');

  const [groups, setGroups] = useState<DuplicateGroupDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchDuplicates() {
      try {
        const res = await fetch('/api/people/duplicates');
        if (res.ok) {
          const data: { groups: DuplicateGroupDisplay[] } = await res.json();
          setGroups(data.groups);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchDuplicates();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navigation currentPath="/people/duplicates" />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-foreground">
              {t('title')}
            </h1>
            <Link
              href="/people"
              className="px-4 py-2 border border-border text-foreground rounded-lg font-semibold hover:bg-surface transition-colors"
            >
              {tCommon('back')}
            </Link>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
              <p className="mt-4 text-muted">{tCommon('loading')}</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-800 rounded-lg p-6">
              <p className="text-red-600 dark:text-red-300">{t('error')}</p>
            </div>
          ) : (
            <DuplicatesList groups={groups} />
          )}
        </div>
      </main>
    </div>
  );
}
