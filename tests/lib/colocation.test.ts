import { describe, it, expect } from 'vitest';
import { coordKey, groupByCoordinates } from '../../lib/map/colocation';
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
    city: null,
    region: null,
    country: null,
    addressText: null,
    groupIds: [],
    hasPhoto: false,
    groupColor: null,
    ...overrides,
  };
}

describe('coordKey', () => {
  it('returns a "lat,lng" string', () => {
    expect(coordKey(51.5, -0.12)).toBe('51.5,-0.12');
  });

  it('preserves full decimal precision', () => {
    expect(coordKey(51.501234, -0.123456)).toBe('51.501234,-0.123456');
  });
});

describe('groupByCoordinates', () => {
  it('returns one group per unique coordinate pair', () => {
    const markers = [
      marker({ id: 'a1', personId: 'p1', latitude: 51.5, longitude: -0.12 }),
      marker({ id: 'a2', personId: 'p2', latitude: 51.5, longitude: -0.12 }),
      marker({ id: 'a3', personId: 'p3', latitude: 40.7, longitude: -74.0 }),
    ];
    const groups = groupByCoordinates(markers);
    expect(groups.size).toBe(2);
    expect(groups.get('51.5,-0.12')).toHaveLength(2);
    expect(groups.get('40.7,-74')).toHaveLength(1);
  });

  it('returns an empty map for empty input', () => {
    expect(groupByCoordinates([]).size).toBe(0);
  });

  it('preserves input order within each group', () => {
    const markers = [
      marker({ id: 'a1', personId: 'p1', latitude: 1, longitude: 2 }),
      marker({ id: 'a2', personId: 'p2', latitude: 1, longitude: 2 }),
      marker({ id: 'a3', personId: 'p3', latitude: 1, longitude: 2 }),
    ];
    const group = groupByCoordinates(markers).get('1,2')!;
    expect(group.map((m) => m.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('treats each solo marker as its own group', () => {
    const markers = [
      marker({ id: 'a1', latitude: 1, longitude: 1 }),
      marker({ id: 'a2', latitude: 2, longitude: 2 }),
      marker({ id: 'a3', latitude: 3, longitude: 3 }),
    ];
    const groups = groupByCoordinates(markers);
    expect(groups.size).toBe(3);
    for (const group of groups.values()) {
      expect(group).toHaveLength(1);
    }
  });
});
