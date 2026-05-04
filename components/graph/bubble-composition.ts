import {
  type BubbleSimNode,
  type PersonSimNode,
  type SimulationNode,
  UNGROUPED_SYNTHETIC_ID,
} from './simulation-types';
import type { GraphMode } from './mode-resolution';

export interface RawGraphPerson {
  id: string;
  label: string;
  groups: string[];
  colors: string[];
  isCenter: boolean;
  photo?: string | null;
}

export interface BuildSimNodesArgs {
  people: RawGraphPerson[];
  groups: Array<{ id: string; name: string; color: string | null }>;
  mode: GraphMode;
  expandedBubbles: Set<string>;
  ungroupedLabel?: string;
}

function toPersonNode(p: RawGraphPerson): PersonSimNode {
  return { kind: 'person', ...p };
}

function formatBubbleLabel(name: string, count: number): string {
  return `${name} · ${count}`;
}

export function buildSimulationNodes(args: BuildSimNodesArgs): SimulationNode[] {
  const { people, groups, mode, expandedBubbles } = args;
  const ungroupedLabel = args.ungroupedLabel ?? 'Unsorted';

  if (mode === 'individuals') {
    return people.map(toPersonNode);
  }

  const groupsById = new Map(groups.map((g) => [g.id, g]));
  const membersByGroup = new Map<string, RawGraphPerson[]>();
  const centerPeople: RawGraphPerson[] = [];

  for (const p of people) {
    if (p.isCenter) {
      centerPeople.push(p);
      continue;
    }
    const primary = p.groups[0] ?? UNGROUPED_SYNTHETIC_ID;
    const list = membersByGroup.get(primary);
    if (list) list.push(p);
    else membersByGroup.set(primary, [p]);
  }

  const out: SimulationNode[] = centerPeople.map(toPersonNode);

  for (const [groupId, members] of membersByGroup) {
    const expanded = expandedBubbles.has(groupId);

    const name = groupId === UNGROUPED_SYNTHETIC_ID
      ? ungroupedLabel
      : groupsById.get(groupId)?.name ?? groupId;
    const color = groupId === UNGROUPED_SYNTHETIC_ID
      ? null
      : groupsById.get(groupId)?.color ?? null;

    const bubble: BubbleSimNode = {
      kind: 'bubble',
      id: `bubble:${groupId}`,
      groupId,
      label: formatBubbleLabel(name, members.length),
      color,
      memberCount: members.length,
      memberIds: members.map((m) => m.id),
      isExpanded: expanded,
    };
    out.push(bubble);

    if (expanded) {
      for (const m of members) out.push(toPersonNode(m));
    }
  }

  return out;
}
