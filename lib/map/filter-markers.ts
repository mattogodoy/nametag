import type { MapMarker } from './types';

export interface MapFilterState {
  query: string;
  groupId: string;
  city: string;
  region: string;
  country: string;
}

export function filterMarkers(markers: MapMarker[], filters: MapFilterState): MapMarker[] {
  const query = filters.query.trim().toLowerCase();
  const city = filters.city.trim().toLowerCase();
  const region = filters.region.trim().toLowerCase();

  return markers.filter((marker) => {
    if (query && !marker.personName.toLowerCase().includes(query)) return false;
    if (filters.groupId && !marker.groupIds.includes(filters.groupId)) return false;
    if (city && (marker.city ?? '').toLowerCase() !== city) return false;
    if (region && (marker.region ?? '').toLowerCase() !== region) return false;
    if (filters.country && marker.country !== filters.country) return false;
    return true;
  });
}

export function distinctCities(markers: MapMarker[]): string[] {
  const seen = new Map<string, string>();
  for (const marker of markers) {
    if (marker.city) {
      const key = marker.city.toLowerCase();
      if (!seen.has(key)) seen.set(key, marker.city);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export function distinctRegions(markers: MapMarker[]): string[] {
  const seen = new Map<string, string>();
  for (const marker of markers) {
    if (marker.region) {
      const key = marker.region.toLowerCase();
      if (!seen.has(key)) seen.set(key, marker.region);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export function distinctCountries(markers: MapMarker[]): string[] {
  const seen = new Set<string>();
  for (const marker of markers) {
    if (marker.country) seen.add(marker.country);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}
