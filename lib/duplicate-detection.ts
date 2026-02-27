/**
 * Duplicate detection utility for finding similar contacts.
 *
 * Uses Levenshtein edit-distance to compute string similarity
 * and a union-find structure to group related duplicates.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DuplicateCandidate {
  personId: string;
  name: string;
  surname: string | null;
  similarity: number;
}

export interface DuplicateGroup {
  people: Array<{ id: string; name: string; surname: string | null }>;
  similarity: number;
}

export interface PersonForComparison {
  id: string;
  name: string;
  surname: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIMILARITY_THRESHOLD = 0.75;

// ---------------------------------------------------------------------------
// Core algorithms
// ---------------------------------------------------------------------------

/**
 * Compute the Levenshtein edit-distance between two strings.
 *
 * Uses a classic dynamic-programming approach with O(min(m,n)) space
 * by keeping only two rows at a time.
 */
export function levenshteinDistance(a: string, b: string): number {
  // Early exits
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure `b` is the shorter string so the working array is smaller.
  if (a.length < b.length) {
    [a, b] = [b, a];
  }

  const bLen = b.length;

  // previous row of distances
  let prev: number[] = Array.from({ length: bLen + 1 }, (_, i) => i);
  // current row
  let curr: number[] = new Array<number>(bLen + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost // substitution
      );
    }
    // swap rows
    [prev, curr] = [curr, prev];
  }

  // After the last swap the result sits in `prev`.
  return prev[bLen];
}

/**
 * Return a similarity score between 0 and 1 for two strings.
 *
 * 1 means the strings are identical; 0 means they are completely
 * different (edit-distance equals the length of the longer string).
 */
export function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1; // two empty strings are identical
  return 1 - levenshteinDistance(a, b) / maxLen;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a normalised comparison string from a name and optional surname.
 * Lowercases and trims the result.
 */
function buildComparisonName(name: string, surname: string | null): string {
  const parts = [name];
  if (surname) {
    parts.push(surname);
  }
  return parts.join(' ').toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// Union-Find (disjoint-set) data structure
// ---------------------------------------------------------------------------

class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;

  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  /** Ensure an element is tracked. */
  makeSet(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  /** Find the representative of the set containing `x` (with path compression). */
  find(x: string): string {
    this.makeSet(x);
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  /** Merge the sets containing `x` and `y` (union by rank). */
  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX)!;
    const rankY = this.rank.get(rootY)!;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find duplicate candidates for a given person.
 *
 * @param targetName    - First name of the person to check
 * @param targetSurname - Surname of the person (may be null)
 * @param people        - Full list of people to compare against
 * @param targetId      - Optional ID of the target person to exclude from results
 * @returns Candidates whose similarity exceeds the threshold, sorted descending.
 */
export function findDuplicates(
  targetName: string,
  targetSurname: string | null,
  people: PersonForComparison[],
  targetId?: string
): DuplicateCandidate[] {
  const targetFull = buildComparisonName(targetName, targetSurname);

  const candidates: DuplicateCandidate[] = [];

  for (const person of people) {
    // Skip the target person itself
    if (targetId && person.id === targetId) continue;

    const personFull = buildComparisonName(person.name, person.surname);
    const similarity = stringSimilarity(targetFull, personFull);

    if (similarity >= SIMILARITY_THRESHOLD) {
      candidates.push({
        personId: person.id,
        name: person.name,
        surname: person.surname,
        similarity,
      });
    }
  }

  // Sort by similarity descending
  candidates.sort((a, b) => b.similarity - a.similarity);

  return candidates;
}

/**
 * Find all groups of potential duplicates across a list of people.
 *
 * Uses union-find to cluster people whose names exceed the similarity
 * threshold. Returns only groups of 2 or more, sorted by highest
 * pairwise similarity within each group (descending).
 */
export function findAllDuplicateGroups(
  people: PersonForComparison[]
): DuplicateGroup[] {
  const uf = new UnionFind();

  // Map from person ID to their comparison name (computed once)
  const compNames = new Map<string, string>();
  for (const person of people) {
    compNames.set(person.id, buildComparisonName(person.name, person.surname));
    uf.makeSet(person.id);
  }

  // Compare every pair
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i];
      const b = people[j];
      const similarity = stringSimilarity(compNames.get(a.id)!, compNames.get(b.id)!);

      if (similarity >= SIMILARITY_THRESHOLD) {
        uf.union(a.id, b.id);
      }
    }
  }

  // Collect groups by root
  const groups = new Map<string, PersonForComparison[]>();
  for (const person of people) {
    const root = uf.find(person.id);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(person);
  }

  // Build result: only groups with 2+ members
  const result: DuplicateGroup[] = [];
  for (const [, members] of groups) {
    if (members.length < 2) continue;

    // Derive max pairwise similarity within this group
    let maxSim = SIMILARITY_THRESHOLD;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const sim = stringSimilarity(
          compNames.get(members[i].id)!,
          compNames.get(members[j].id)!
        );
        if (sim > maxSim) maxSim = sim;
      }
    }

    result.push({
      people: members.map((p) => ({
        id: p.id,
        name: p.name,
        surname: p.surname,
      })),
      similarity: maxSim,
    });
  }

  // Sort groups by similarity descending
  result.sort((a, b) => b.similarity - a.similarity);

  return result;
}
