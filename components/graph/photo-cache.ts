import type { PhotoCacheEntry } from './simulation-types';

const cache = new Map<string, PhotoCacheEntry>();

export function getCachedPhoto(personId: string): PhotoCacheEntry | undefined {
  return cache.get(personId);
}

export function loadPhoto(
  personId: string,
  src: string,
  onReady: () => void,
): void {
  const existing = cache.get(personId);
  if (existing !== undefined) return;

  cache.set(personId, 'loading');
  const img = new Image();
  img.onload = () => {
    cache.set(personId, img);
    onReady();
  };
  img.onerror = () => {
    cache.set(personId, 'error');
  };
  img.src = src;
}

export function __resetPhotoCacheForTests(): void {
  cache.clear();
}
