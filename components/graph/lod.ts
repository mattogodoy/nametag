import type { LODTier } from './simulation-types';

export const LOD_THRESHOLD_LABELS = 0.6;
export const LOD_THRESHOLD_FULL = 1.2;

export function getLODTier(zoomK: number): LODTier {
  if (zoomK < LOD_THRESHOLD_LABELS) return 'dots';
  if (zoomK < LOD_THRESHOLD_FULL) return 'labels';
  return 'full';
}
