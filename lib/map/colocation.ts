import type { MapMarker } from './types';

export function coordKey(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

export function groupByCoordinates(markers: MapMarker[]): Map<string, MapMarker[]> {
  const groups = new Map<string, MapMarker[]>();
  for (const m of markers) {
    const key = coordKey(m.latitude, m.longitude);
    const group = groups.get(key);
    if (group) {
      group.push(m);
    } else {
      groups.set(key, [m]);
    }
  }
  return groups;
}
