import { describe, it, expect } from 'vitest';
import { diffSimulationData } from '../../../components/graph/diff-simulation';
import type { SimulationNode, SimulationEdge } from '../../../components/graph/simulation-types';

const mkNode = (id: string, partial: Partial<SimulationNode> = {}): SimulationNode => {
  const base = {
    kind: 'person' as const,
    id,
    label: id,
    groups: [] as string[],
    colors: [] as string[],
    isCenter: false,
  };
  return { ...base, ...partial } as SimulationNode;
};

describe('diffSimulationData', () => {
  it('retains positions of existing nodes by id', () => {
    const prev = [mkNode('a', { x: 100, y: 200, vx: 1, vy: 2 })];
    const incoming = [mkNode('a', { label: 'updated label' })];
    const { nodes } = diffSimulationData(prev, incoming, [], []);
    expect(nodes[0].id).toBe('a');
    expect(nodes[0].x).toBe(100);
    expect(nodes[0].y).toBe(200);
    expect(nodes[0].vx).toBe(1);
    expect(nodes[0].vy).toBe(2);
    expect(nodes[0].label).toBe('updated label');
  });

  it('drops nodes that are no longer in the incoming set', () => {
    const prev = [mkNode('a', { x: 0, y: 0 }), mkNode('b', { x: 50, y: 50 })];
    const incoming = [mkNode('a')];
    const { nodes } = diffSimulationData(prev, incoming, [], []);
    expect(nodes.map((n) => n.id)).toEqual(['a']);
  });

  it('assigns new nodes a start position near connected retained nodes', () => {
    const prev = [mkNode('a', { x: 100, y: 200 })];
    const incoming = [mkNode('a'), mkNode('b')];
    const incomingEdges: SimulationEdge[] = [
      { source: 'a', target: 'b', type: 'friend', color: '#fff' },
    ];
    const { nodes } = diffSimulationData(prev, incoming, [], incomingEdges);
    const b = nodes.find((n) => n.id === 'b')!;
    expect(b.x).toBeCloseTo(100, 0);
    expect(b.y).toBeCloseTo(200, 0);
  });

  it('falls back to (0, 0) start position for disconnected new nodes', () => {
    const { nodes } = diffSimulationData([], [mkNode('orphan')], [], []);
    expect(nodes[0].x).toBe(0);
    expect(nodes[0].y).toBe(0);
  });

  it('drops edges whose endpoints are not in the retained node set', () => {
    const incoming = [mkNode('a')];
    const incomingEdges: SimulationEdge[] = [
      { source: 'a', target: 'missing', type: 'friend', color: '#fff' },
    ];
    const { edges } = diffSimulationData([], incoming, [], incomingEdges);
    expect(edges).toEqual([]);
  });
});
