import { describe, it, expect } from 'vitest';
import { filterMarkers, distinctCities, distinctCountries, distinctRegions } from '../../lib/map/filter-markers';
import type { MapMarker } from '../../lib/map/types';

function marker(overrides: Partial<MapMarker>): MapMarker {
  return {
    id: 'addr_1',
    source: 'address',
    personId: 'p1',
    personName: 'Alice Smith',
    latitude: 0,
    longitude: 0,
    label: 'home',
    city: 'London',
    region: 'Greater London',
    country: 'GB',
    addressText: null,
    groupIds: ['g1'],
    ...overrides,
  };
}

const markers: MapMarker[] = [
  marker({ id: 'addr_1', personName: 'Alice Smith', city: 'London', region: 'Greater London', country: 'GB', groupIds: ['g1'] }),
  marker({ id: 'addr_2', personName: 'Bob Jones', city: 'Paris', region: 'Ile-de-France', country: 'FR', groupIds: ['g2'] }),
  marker({ id: 'loc_1', source: 'location', personName: 'Carol King', city: null, region: null, country: null, groupIds: [] }),
];

const noFilters = { query: '', groupId: '', city: '', region: '', country: '' };

describe('filterMarkers', () => {
  it('returns everything when no filters are set', () => {
    expect(filterMarkers(markers, noFilters)).toHaveLength(3);
  });

  it('filters by name, case-insensitively', () => {
    const result = filterMarkers(markers, { ...noFilters, query: 'alice' });
    expect(result.map((m) => m.id)).toEqual(['addr_1']);
  });

  it('filters by group', () => {
    const result = filterMarkers(markers, { ...noFilters, groupId: 'g2' });
    expect(result.map((m) => m.id)).toEqual(['addr_2']);
  });

  it('filters by city and by country', () => {
    expect(filterMarkers(markers, { ...noFilters, city: 'london' }).map((m) => m.id)).toEqual(['addr_1']);
    expect(filterMarkers(markers, { ...noFilters, country: 'FR' }).map((m) => m.id)).toEqual(['addr_2']);
  });

  it('filters by region, case-insensitively', () => {
    expect(filterMarkers(markers, { ...noFilters, region: 'ile-de-france' }).map((m) => m.id)).toEqual(['addr_2']);
  });

  it('combines filters with AND semantics', () => {
    expect(filterMarkers(markers, { ...noFilters, query: 'alice', country: 'FR' })).toHaveLength(0);
  });
});

describe('distinct value helpers', () => {
  it('lists sorted distinct cities, skipping nulls', () => {
    expect(distinctCities(markers)).toEqual(['London', 'Paris']);
  });

  it('lists sorted distinct countries, skipping nulls', () => {
    expect(distinctCountries(markers)).toEqual(['FR', 'GB']);
  });

  it('lists sorted distinct regions, skipping nulls', () => {
    expect(distinctRegions(markers)).toEqual(['Greater London', 'Ile-de-France']);
  });
});
