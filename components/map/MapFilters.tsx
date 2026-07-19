'use client';

import { useTranslations } from 'next-intl';
import type { MapGroup, MapMarker } from '@/lib/map/types';
import { distinctCities, distinctCountries, type MapFilterState } from '@/lib/map/filter-markers';
import { getCountryName } from '@/lib/countries';

interface MapFiltersProps {
  filters: MapFilterState;
  markers: MapMarker[];
  groups: MapGroup[];
  onChange: (next: MapFilterState) => void;
}

export default function MapFilters({ filters, markers, groups, onChange }: MapFiltersProps) {
  const t = useTranslations('map');
  const cities = distinctCities(markers);
  const countries = distinctCountries(markers);
  const hasActiveFilters = Boolean(filters.query || filters.groupId || filters.city || filters.country);

  const selectClasses =
    'px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-surface border-b border-border">
      <input
        type="search"
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder={t('searchPlaceholder')}
        className={`${selectClasses} flex-1 min-w-[10rem]`}
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

      <select
        value={filters.city}
        onChange={(e) => onChange({ ...filters, city: e.target.value })}
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
        value={filters.country}
        onChange={(e) => onChange({ ...filters, country: e.target.value })}
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
        <button
          type="button"
          onClick={() => onChange({ query: '', groupId: '', city: '', country: '' })}
          className="px-3 py-2 text-sm text-primary hover:text-primary-dark transition-colors"
        >
          {t('clearFilters')}
        </button>
      )}
    </div>
  );
}
