import { describe, it, expect } from 'vitest';
import { buildHubAndSpokeEdges } from '../../../components/graph/edge-composition';
import type { SimulationEdge, SimulationNode } from '../../../components/graph/simulation-types';

const center: SimulationNode = {
  kind: 'person', id: 'user-1', label: 'You', groups: [], colors: [], isCenter: true,
};
const alice: SimulationNode = {
  kind: 'person', id: 'p-alice', label: 'Alice', groups: ['g-family'], colors: [], isCenter: false,
};
const bubbleFamily: SimulationNode = {
  kind: 'bubble', id: 'bubble:g-family', groupId: 'g-family', label: 'Family · 2',
  color: null, memberCount: 2, memberIds: ['p-alice', 'p-bob'], isExpanded: false,
};
const bubbleFamilyExpanded: SimulationNode = {
  kind: 'bubble', id: 'bubble:g-family', groupId: 'g-family', label: 'Family · 2',
  color: null, memberCount: 2, memberIds: ['p-alice', 'p-bob'], isExpanded: true,
};
const bubbleWork: SimulationNode = {
  kind: 'bubble', id: 'bubble:g-work', groupId: 'g-work', label: 'Work · 1',
  color: null, memberCount: 1, memberIds: ['p-carol'], isExpanded: false,
};

const neutralColor = '#888';

describe('buildHubAndSpokeEdges', () => {
  it('returns raw edges unchanged when all endpoints are persons still present', () => {
    const rawEdges: SimulationEdge[] = [
      { source: 'user-1', target: 'p-alice', type: 'friend', color: '#f00' },
    ];
    const out = buildHubAndSpokeEdges({
      rawEdges,
      simNodes: [center, alice],
      centerNodeId: 'user-1',
      neutralEdgeColor: neutralColor,
    });
    expect(out).toEqual(rawEdges);
  });

  it('collapses a person→bubble edge into a single you→bubble edge', () => {
    const rawEdges: SimulationEdge[] = [
      { source: 'user-1', target: 'p-alice', type: 'friend', color: '#f00' },
    ];
    const out = buildHubAndSpokeEdges({
      rawEdges,
      simNodes: [center, bubbleFamily],
      centerNodeId: 'user-1',
      neutralEdgeColor: neutralColor,
    });
    expect(out).toEqual([
      { source: 'user-1', target: 'bubble:g-family', type: 'aggregated', color: neutralColor },
    ]);
  });

  it('emits at most one you→bubble edge per bubble regardless of underlying edge count', () => {
    const rawEdges: SimulationEdge[] = [
      { source: 'user-1', target: 'p-alice', type: 'friend', color: '#f00' },
      { source: 'user-1', target: 'p-bob',   type: 'family', color: '#f00' },
    ];
    const out = buildHubAndSpokeEdges({
      rawEdges,
      simNodes: [center, bubbleFamily],
      centerNodeId: 'user-1',
      neutralEdgeColor: neutralColor,
    });
    expect(out).toHaveLength(1);
    expect(out[0].target).toBe('bubble:g-family');
  });

  it('hides edges that do not touch the center', () => {
    const rawEdges: SimulationEdge[] = [
      { source: 'p-alice', target: 'p-bob', type: 'sibling', color: '#f00' },
    ];
    const out = buildHubAndSpokeEdges({
      rawEdges,
      simNodes: [center, bubbleFamily, bubbleWork],
      centerNodeId: 'user-1',
      neutralEdgeColor: neutralColor,
    });
    expect(out).toEqual([]);
  });

  it('handles inverse direction (person→you)', () => {
    const rawEdges: SimulationEdge[] = [
      { source: 'p-alice', target: 'user-1', type: 'parent', color: '#f00' },
    ];
    const out = buildHubAndSpokeEdges({
      rawEdges,
      simNodes: [center, bubbleFamily],
      centerNodeId: 'user-1',
      neutralEdgeColor: neutralColor,
    });
    expect(out).toEqual([
      { source: 'bubble:g-family', target: 'user-1', type: 'aggregated', color: neutralColor },
    ]);
  });

  it('emits direct person edges when the bubble is expanded plus a membership tether to the ghost', () => {
    const alicePerson: SimulationNode = {
      kind: 'person', id: 'p-alice', label: 'Alice', groups: ['g-family'], colors: [], isCenter: false,
    };
    const rawEdges: SimulationEdge[] = [
      { source: 'user-1', target: 'p-alice', type: 'friend', color: '#f00' },
    ];
    const out = buildHubAndSpokeEdges({
      rawEdges,
      simNodes: [center, bubbleFamilyExpanded, alicePerson],
      centerNodeId: 'user-1',
      neutralEdgeColor: neutralColor,
    });
    expect(out).toEqual([
      { source: 'user-1', target: 'p-alice', type: 'friend', color: '#f00' },
      { source: 'bubble:g-family', target: 'p-alice', type: 'membership', color: neutralColor },
    ]);
  });

  it('tethers expanded-bubble members to the ghost even when they have no relationship to you', () => {
    const carolPerson: SimulationNode = {
      kind: 'person', id: 'p-carol', label: 'Carol', groups: ['g-family'], colors: [], isCenter: false,
    };
    const expandedFamily: SimulationNode = {
      ...bubbleFamilyExpanded,
      memberIds: ['p-carol'],
      memberCount: 1,
    };
    const out = buildHubAndSpokeEdges({
      rawEdges: [],
      simNodes: [center, expandedFamily, carolPerson],
      centerNodeId: 'user-1',
      neutralEdgeColor: neutralColor,
    });
    expect(out).toEqual([
      { source: 'bubble:g-family', target: 'p-carol', type: 'membership', color: neutralColor },
    ]);
  });
});
