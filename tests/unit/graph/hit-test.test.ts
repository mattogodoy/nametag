import { describe, it, expect } from 'vitest';
import { buildQuadtree, findNodeAtPoint } from '../../../components/graph/hit-test';
import type { SimulationNode } from '../../../components/graph/simulation-types';

const makeNode = (id: string, x: number, y: number): SimulationNode => ({
  kind: 'person',
  id,
  label: id,
  groups: [],
  colors: [],
  isCenter: false,
  x,
  y,
});

describe('hit-test', () => {
  it('finds the nearest node within the hit radius', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 100, 100)];
    const quadtree = buildQuadtree(nodes);
    expect(findNodeAtPoint(quadtree, 2, 2, 10)?.id).toBe('a');
    expect(findNodeAtPoint(quadtree, 98, 98, 10)?.id).toBe('b');
  });

  it('returns undefined when no node is within the hit radius', () => {
    const nodes = [makeNode('a', 0, 0)];
    const quadtree = buildQuadtree(nodes);
    expect(findNodeAtPoint(quadtree, 50, 50, 10)).toBeUndefined();
  });

  it('returns undefined for an empty node set', () => {
    const quadtree = buildQuadtree([]);
    expect(findNodeAtPoint(quadtree, 0, 0, 10)).toBeUndefined();
  });

  it('ignores nodes missing x/y (unpositioned)', () => {
    const nodes: SimulationNode[] = [
      { kind: 'person', id: 'a', label: 'a', groups: [], colors: [], isCenter: false },
    ];
    const quadtree = buildQuadtree(nodes);
    expect(findNodeAtPoint(quadtree, 0, 0, 10)).toBeUndefined();
  });
});
