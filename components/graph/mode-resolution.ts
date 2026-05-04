export type GraphMode = 'individuals' | 'bubbles';

/**
 * Resolve the active graph mode from the user's saved preference.
 * When unset (null), the graph defaults to showing individuals.
 */
export function resolveGraphMode(graphMode: GraphMode | null): GraphMode {
  return graphMode ?? 'individuals';
}
