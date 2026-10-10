import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import Navigation from '@/components/Navigation';
import PersonAvatar from '@/components/PersonPhoto';
import { Button } from '@/components/ui/Button';
import { formatFullName } from '@/lib/nameUtils';
import { getUserDisplayPreferences } from '@/lib/user-preferences';
import {
  advancedSearchPeople,
  hasActiveFilters,
  parseAdvancedSearchFilters,
  ADVANCED_SEARCH_FILTER_KEYS,
  ADVANCED_SEARCH_MAX_RESULTS,
} from '@/lib/advanced-search';

const inputClass =
  'w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const t = await getTranslations('advancedSearch');
  const filters = parseAdvancedSearchFilters(await searchParams);
  const active = hasActiveFilters(filters);

  const [{ results, total }, { nameOrder, nameDisplayFormat }] = await Promise.all([
    advancedSearchPeople(session.user.id, filters),
    getUserDisplayPreferences(session.user.id),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/search"
      />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('title')}</h1>
          <p className="text-muted mb-6">{t('description')}</p>

          <form
            method="get"
            action="/search"
            role="search"
            className="bg-surface border border-border rounded-lg p-4 sm:p-6 mb-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ADVANCED_SEARCH_FILTER_KEYS.map((key) => (
                <div key={key} className={key === 'keywords' ? 'sm:col-span-2' : undefined}>
                  <label htmlFor={`search-${key}`} className="block text-sm font-medium text-muted mb-1">
                    {t(`fields.${key}.label`)}
                  </label>
                  <input
                    id={`search-${key}`}
                    name={key}
                    type={key === 'email' ? 'search' : key === 'phone' ? 'tel' : 'text'}
                    defaultValue={filters[key]}
                    placeholder={t(`fields.${key}.placeholder`)}
                    autoComplete="off"
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <Button type="submit">{t('submit')}</Button>
              {active && (
                <Button href="/search" variant="secondary">
                  {t('clear')}
                </Button>
              )}
            </div>
          </form>

          {active && (
            <section aria-live="polite">
              <p className="text-sm text-muted mb-3">
                {total > ADVANCED_SEARCH_MAX_RESULTS
                  ? t('resultsTruncated', { shown: ADVANCED_SEARCH_MAX_RESULTS, total })
                  : t('resultCount', { count: total })}
              </p>

              {results.length === 0 ? (
                <div className="bg-surface border border-border rounded-lg p-6 text-center text-muted">
                  {t('noResults')}
                </div>
              ) : (
                <ul className="bg-surface border border-border rounded-lg divide-y divide-border">
                  {results.map((person) => {
                    const displayName = formatFullName(person, nameOrder, nameDisplayFormat);
                    const details = [person.locations[0], person.emails[0], person.phones[0]].filter(Boolean);
                    return (
                      <li key={person.id}>
                        <Link
                          href={`/people/${person.id}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <PersonAvatar personId={person.id} name={displayName} photo={person.photo} size={40} />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{displayName}</p>
                            {details.length > 0 && (
                              <p className="text-sm text-muted truncate">{details.join(' · ')}</p>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
