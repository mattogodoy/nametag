'use client';

import { useTranslations } from 'next-intl';
import type { MapGroup, MapMarker } from '@/lib/map/types';
import { distinctCities, distinctCountries, distinctRegions, type MapFilterState } from '@/lib/map/filter-markers';
import { getCountryName } from '@/lib/countries';

interface MapFiltersProps {
  filters: MapFilterState;
  markers: MapMarker[];
  groups: MapGroup[];
  /** Number of markers matching the active filters */
  resultCount: number;
  onChange: (next: MapFilterState) => void;
}

export default function MapFilters({ filters, markers, groups, resultCount, onChange }: MapFiltersProps) {
  const t = useTranslations('map');
  const cities = distinctCities(markers);
  const regions = distinctRegions(markers);
  const countries = distinctCountries(markers);
  const hasActiveFilters = Boolean(
    filters.query || filters.groupId || filters.city || filters.region || filters.country
  );

  // Mobile: search on its own row, the four selects in a 2x2 grid, and the
  // result count plus clear button sharing one row. Desktop (sm+): a single
  // wrapping flex row, with the count/clear wrapper dissolved via
  // sm:contents so its children flow inline like the other items.
  const selectClasses =
    'w-full sm:w-auto px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center px-4 py-3 bg-surface border-b border-border">
      <input
        type="search"
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder={t('searchPlaceholder')}
        className={`${selectClasses} col-span-2 sm:flex-1 sm:min-w-[10rem]`}
        aria-label={t('searchPlaceholder')}
      />

      <select
        value={filters.groupId}
        onChange={(e) => onChange({ ...filters, groupId: e.target.value })}
        className={selectClasses}
        aria-label={t('allGroups')}
      >
        <option value="">{t('allGroups')}</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>

      {/* City, state/province and country are mutually exclusive: picking
          one clears the others, since combining them mostly produces
          impossible matches. */}
      <select
        value={filters.city}
        onChange={(e) => onChange({ ...filters, city: e.target.value, region: '', country: '' })}
        className={selectClasses}
        aria-label={t('allCities')}
      >
        <option value="">{t('allCities')}</option>
        {cities.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>

      <select
        value={filters.region}
        onChange={(e) => onChange({ ...filters, region: e.target.value, city: '', country: '' })}
        className={selectClasses}
        aria-label={t('allRegions')}
      >
        <option value="">{t('allRegions')}</option>
        {regions.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </select>

      <select
        value={filters.country}
        onChange={(e) => onChange({ ...filters, country: e.target.value, city: '', region: '' })}
        className={selectClasses}
        aria-label={t('allCountries')}
      >
        <option value="">{t('allCountries')}</option>
        {countries.map((country) => (
          <option key={country} value={country}>
            {getCountryName(country) || country}
          </option>
        ))}
      </select>

      {hasActiveFilters && (
        <div className="col-span-2 flex items-center justify-between gap-2 sm:contents">
          <span className="text-sm text-muted whitespace-nowrap" role="status">
            {t('resultsCount', { count: resultCount })}
          </span>
          <button
            type="button"
            onClick={() => onChange({ query: '', groupId: '', city: '', region: '', country: '' })}
            className="px-3 py-2 text-sm text-primary hover:text-primary-dark transition-colors whitespace-nowrap"
          >
            {t('clearFilters')}
          </button>
        </div>
      )}
    </div>
  );
}
