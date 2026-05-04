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
  it('returns raw edges unchanged when both endpoints are persons', () => {
    const rawEdges: SimulationEdge[] = [
      { source: 'user-1', target: 'p-alice', type: 'friend', color: '#f00' },
    ];
    const out = buildHubAndSpokeEdges({
      rawEdges,
      simNodes: [center, alice],
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
      neutralEdgeColor: neutralColor,
    });
    expect(out).toHaveLength(1);
    expect(out[0].target).toBe('bubble:g-family');
  });

  it('hides bubble↔bubble edges between two collapsed bubbles', () => {
    const rawEdges: SimulationEdge[] = [
      { source: 'p-alice', target: 'p-carol', type: 'friend', color: '#f00' },
    ];
    const out = buildHubAndSpokeEdges({
      rawEdges,
      simNodes: [center, bubbleFamily, bubbleWork],
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
      neutralEdgeColor: neutralColor,
    });
    expect(out).toEqual([
      { source: 'bubble:g-family', target: 'user-1', type: 'aggregated', color: neutralColor },
    ]);
  });

  it('emits direct person edges when the source bubble is expanded (you→member)', () => {
    const alicePerson: SimulationNode = {
      kind: 'person', id: 'p-alice', label: 'Alice', groups: ['g-family'], colors: [], isCenter: false,
    };
    const rawEdges: SimulationEdge[] = [
      { source: 'user-1', target: 'p-alice', type: 'friend', color: '#f00' },
    ];
    const out = buildHubAndSpokeEdges({
      rawEdges,
      simNodes: [center, bubbleFamilyExpanded, alicePerson],
      neutralEdgeColor: neutralColor,
    });
    expect(out).toEqual([
      { source: 'user-1', target: 'p-alice', type: 'friend', color: '#f00' },
      { source: 'bubble:g-family', target: 'p-alice', type: 'membership', color: neutralColor },
    ]);
  });

  it('shows direct person↔person edges between non-center expanded members', () => {
    // John is in expanded Work, Sarah is in expanded Family. John is father of Sarah.
    const johnPerson: SimulationNode = {
      kind: 'person', id: 'p-john', label: 'John', groups: ['g-work'], colors: [], isCenter: false,
    };
    const sarahPerson: SimulationNode = {
      kind: 'person', id: 'p-sarah', label: 'Sarah', groups: ['g-family'], colors: [], isCenter: false,
    };
    const expandedWork: SimulationNode = {
      kind: 'bubble', id: 'bubble:g-work', groupId: 'g-work', label: 'Work · 1',
      color: null, memberCount: 1, memberIds: ['p-john'], isExpanded: true,
    };
    const expandedFamily: SimulationNode = {
      kind: 'bubble', id: 'bubble:g-family', groupId: 'g-family', label: 'Family · 1',
      color: null, memberCount: 1, memberIds: ['p-sarah'], isExpanded: true,
    };
    const rawEdges: SimulationEdge[] = [
      { source: 'p-john', target: 'p-sarah', type: 'father', color: '#0f0' },
    ];
    const out = buildHubAndSpokeEdges({
      rawEdges,
      simNodes: [center, expandedWork, johnPerson, expandedFamily, sarahPerson],
      neutralEdgeColor: neutralColor,
    });
    expect(out).toEqual([
      { source: 'p-john', target: 'p-sarah', type: 'father', color: '#0f0' },
      { source: 'bubble:g-work', target: 'p-john', type: 'membership', color: neutralColor },
      { source: 'bubble:g-family', target: 'p-sarah', type: 'membership', color: neutralColor },
    ]);
  });

  it('emits invisible membership tethers from each expanded ghost to its present members', () => {
    const alicePerson: SimulationNode = {
      kind: 'person', id: 'p-alice', label: 'Alice', groups: ['g-family'], colors: [], isCenter: false,
    };
    const bobPerson: SimulationNode = {
      kind: 'person', id: 'p-bob', label: 'Bob', groups: ['g-family'], colors: [], isCenter: false,
    };
    const out = buildHubAndSpokeEdges({
      rawEdges: [],
      simNodes: [center, bubbleFamilyExpanded, alicePerson, bobPerson],
      neutralEdgeColor: neutralColor,
    });
    expect(out).toEqual([
      { source: 'bubble:g-family', target: 'p-alice', type: 'membership', color: neutralColor },
      { source: 'bubble:g-family', target: 'p-bob',   type: 'membership', color: neutralColor },
    ]);
  });

  it('aggregates expanded-person ↔ collapsed-bubble edges to neutral person→bubble edges', () => {
    // John is expanded (Work), Sarah is hidden inside collapsed Family bubble.
    const johnPerson: SimulationNode = {
      kind: 'person', id: 'p-john', label: 'John', groups: ['g-work'], colors: [], isCenter: false,
    };
    const expandedWork: SimulationNode = {
      kind: 'bubble', id: 'bubble:g-work', groupId: 'g-work', label: 'Work · 1',
      color: null, memberCount: 1, memberIds: ['p-john'], isExpanded: true,
    };
    const collapsedFamily: SimulationNode = {
      kind: 'bubble', id: 'bubble:g-family', groupId: 'g-family', label: 'Family · 1',
      color: null, memberCount: 1, memberIds: ['p-sarah'], isExpanded: false,
    };
    const rawEdges: SimulationEdge[] = [
      { source: 'p-john', target: 'p-sarah', type: 'father', color: '#0f0' },
    ];
    const out = buildHubAndSpokeEdges({
      rawEdges,
      simNodes: [center, expandedWork, johnPerson, collapsedFamily],
      neutralEdgeColor: neutralColor,
    });
    expect(out).toEqual([
      { source: 'p-john', target: 'bubble:g-family', type: 'aggregated', color: neutralColor },
      { source: 'bubble:g-work', target: 'p-john', type: 'membership', color: neutralColor },
    ]);
  });
});
