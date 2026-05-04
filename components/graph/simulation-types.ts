// components/graph/simulation-types.ts
import type { SimulationNodeDatum } from 'd3-force';

export type LODTier = 'dots' | 'labels' | 'full';

export interface PersonSimNode extends SimulationNodeDatum {
  kind: 'person';
  id: string;
  label: string;
  groups: string[];
  colors: string[];
  isCenter: boolean;
  photo?: string | null;
}

export interface BubbleSimNode extends SimulationNodeDatum {
  kind: 'bubble';
  id: string;            // 'bubble:<groupId>' or 'bubble:__ungrouped__'
  groupId: string;       // real group id or '__ungrouped__'
  label: string;         // display label incl. count — "Family · 24"
  color: string | null;  // group color or null
  memberCount: number;
  memberIds: string[];
  isExpanded: boolean;   // when true, members are also emitted; this node is a ghost collapse-target
}

export type SimulationNode = PersonSimNode | BubbleSimNode;

export interface SimulationEdge {
  source: string | SimulationNode;
  target: string | SimulationNode;
  type: string;
  color: string;
  sourceLabel?: string;
  targetLabel?: string;
}

export type PhotoCacheEntry = HTMLImageElement | 'loading' | 'error';

export const UNGROUPED_SYNTHETIC_ID = '__ungrouped__';
