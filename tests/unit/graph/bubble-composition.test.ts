import { describe, it, expect } from 'vitest';
import { buildSimulationNodes, type RawGraphPerson } from '../../../components/graph/bubble-composition';
import { UNGROUPED_SYNTHETIC_ID } from '../../../components/graph/simulation-types';

const center: RawGraphPerson = {
  id: 'user-1', label: 'You', groups: [], colors: [], isCenter: true, photo: null,
};
const alice: RawGraphPerson = {
  id: 'p-alice', label: 'Alice', groups: ['g-family'], colors: ['#ff0000'], isCenter: false, photo: null,
};
const bob: RawGraphPerson = {
  id: 'p-bob', label: 'Bob', groups: ['g-family'], colors: ['#ff0000'], isCenter: false, photo: null,
};
const carol: RawGraphPerson = {
  id: 'p-carol', label: 'Carol', groups: ['g-work'], colors: ['#0000ff'], isCenter: false, photo: null,
};
const dave: RawGraphPerson = {
  id: 'p-dave', label: 'Dave', groups: [], colors: [], isCenter: false, photo: null,
};
const eve: RawGraphPerson = {
  id: 'p-eve', label: 'Eve', groups: ['g-family', 'g-work'], colors: ['#ff0000'], isCenter: false, photo: null,
};

const groups = [
  { id: 'g-family', name: 'Family', color: '#ff0000' },
  { id: 'g-work', name: 'Work', color: '#0000ff' },
];

describe('buildSimulationNodes', () => {
  it('returns one person per input in individuals mode', () => {
    const nodes = buildSimulationNodes({
      people: [center, alice, bob, carol],
      groups,
      mode: 'individuals',
      expandedBubbles: new Set(),
    });
    expect(nodes.map((n) => n.id).sort()).toEqual(['p-alice', 'p-bob', 'p-carol', 'user-1'].sort());
    expect(nodes.every((n) => n.kind === 'person')).toBe(true);
  });

  it('collapses each group into a bubble in bubbles mode', () => {
    const nodes = buildSimulationNodes({
      people: [center, alice, bob, carol],
      groups,
      mode: 'bubbles',
      expandedBubbles: new Set(),
    });
    const bubbles = nodes.filter((n) => n.kind === 'bubble');
    expect(bubbles.map((b) => b.kind === 'bubble' ? b.groupId : '').sort()).toEqual(['g-family', 'g-work']);
    const family = bubbles.find((b) => b.kind === 'bubble' && b.groupId === 'g-family')!;
    expect(family.kind).toBe('bubble');
    if (family.kind === 'bubble') {
      expect(family.memberIds.sort()).toEqual(['p-alice', 'p-bob']);
      expect(family.memberCount).toBe(2);
      expect(family.color).toBe('#ff0000');
    }
  });

  it('keeps the center node as a person in bubbles mode', () => {
    const nodes = buildSimulationNodes({
      people: [center, alice],
      groups,
      mode: 'bubbles',
      expandedBubbles: new Set(),
    });
    const centerNode = nodes.find((n) => n.id === 'user-1');
    expect(centerNode?.kind).toBe('person');
  });

  it('rolls ungrouped people into a synthetic "Unsorted" bubble', () => {
    const nodes = buildSimulationNodes({
      people: [center, dave],
      groups,
      mode: 'bubbles',
      expandedBubbles: new Set(),
      ungroupedLabel: 'Unsorted',
    });
    const bubble = nodes.find((n) => n.kind === 'bubble' && n.groupId === UNGROUPED_SYNTHETIC_ID);
    expect(bubble).toBeDefined();
    if (bubble?.kind === 'bubble') {
      expect(bubble.memberIds).toEqual(['p-dave']);
      expect(bubble.label).toContain('Unsorted');
    }
  });

  it('assigns multi-group people to their first group only', () => {
    const nodes = buildSimulationNodes({
      people: [center, eve],
      groups,
      mode: 'bubbles',
      expandedBubbles: new Set(),
    });
    const family = nodes.find((n) => n.kind === 'bubble' && n.groupId === 'g-family');
    const work = nodes.find((n) => n.kind === 'bubble' && n.groupId === 'g-work');
    expect(family).toBeDefined();
    expect(work).toBeUndefined();
    if (family?.kind === 'bubble') expect(family.memberIds).toEqual(['p-eve']);
  });

  it('expands listed bubbles to individuals AND keeps a ghost bubble as collapse target', () => {
    const nodes = buildSimulationNodes({
      people: [center, alice, bob, carol],
      groups,
      mode: 'bubbles',
      expandedBubbles: new Set(['g-family']),
    });
    expect(nodes.find((n) => n.id === 'p-alice')?.kind).toBe('person');
    expect(nodes.find((n) => n.id === 'p-bob')?.kind).toBe('person');
    const familyGhost = nodes.find((n) => n.kind === 'bubble' && n.groupId === 'g-family');
    expect(familyGhost).toBeDefined();
    if (familyGhost?.kind === 'bubble') {
      expect(familyGhost.isExpanded).toBe(true);
      expect(familyGhost.memberIds.sort()).toEqual(['p-alice', 'p-bob']);
    }
    const workBubble = nodes.find((n) => n.kind === 'bubble' && n.groupId === 'g-work');
    expect(workBubble).toBeDefined();
    if (workBubble?.kind === 'bubble') expect(workBubble.isExpanded).toBe(false);
  });

  it('formats bubble labels with the count', () => {
    const nodes = buildSimulationNodes({
      people: [center, alice, bob],
      groups,
      mode: 'bubbles',
      expandedBubbles: new Set(),
    });
    const family = nodes.find((n) => n.kind === 'bubble' && n.groupId === 'g-family');
    expect(family?.label).toMatch(/Family.*2/);
  });
});
