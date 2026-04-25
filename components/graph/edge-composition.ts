import type { SimulationEdge, SimulationNode } from './simulation-types';

export interface BuildEdgesArgs {
  rawEdges: SimulationEdge[];
  simNodes: SimulationNode[];
  neutralEdgeColor: string;
}

/**
 * Build the visible edge set for bubble mode.
 *
 * Rule: an edge is visible if at least one endpoint is a visible person sim node.
 *  - person ↔ person (direct):    keep with original color and type.
 *  - person ↔ collapsed bubble:   aggregate to one neutral edge person→bubble.
 *  - bubble ↔ bubble:             hide (avoids noise when groups are collapsed).
 *
 * Members of expanded ghost bubbles are present as their own person nodes,
 * so the ghost itself is treated as having no members for mapping purposes.
 */
export function buildHubAndSpokeEdges(args: BuildEdgesArgs): SimulationEdge[] {
  const { rawEdges, simNodes, neutralEdgeColor } = args;

  // Map person id → the sim-node id that represents them (themselves or a non-expanded bubble).
  // Expanded (ghost) bubbles do NOT claim their members: members are present as person nodes.
  const personToSimNode = new Map<string, string>();
  for (const n of simNodes) {
    if (n.kind === 'person') personToSimNode.set(n.id, n.id);
  }
  for (const n of simNodes) {
    if (n.kind !== 'bubble' || n.isExpanded) continue;
    for (const memberId of n.memberIds) {
      if (!personToSimNode.has(memberId)) personToSimNode.set(memberId, n.id);
    }
  }

  const emitted = new Set<string>();
  const out: SimulationEdge[] = [];

  const endpoint = (v: string | SimulationNode): string => (typeof v === 'string' ? v : v.id);

  for (const edge of rawEdges) {
    const srcPerson = endpoint(edge.source);
    const tgtPerson = endpoint(edge.target);
    const srcSim = personToSimNode.get(srcPerson) ?? srcPerson;
    const tgtSim = personToSimNode.get(tgtPerson) ?? tgtPerson;

    const srcIsBubble = srcSim.startsWith('bubble:');
    const tgtIsBubble = tgtSim.startsWith('bubble:');

    // Hide edges where both endpoints collapse into bubbles — too noisy.
    if (srcIsBubble && tgtIsBubble) continue;

    const isAggregated = srcIsBubble || tgtIsBubble;

    const key = `${srcSim}|${tgtSim}`;
    if (emitted.has(key)) continue;
    emitted.add(key);

    out.push({
      source: srcSim,
      target: tgtSim,
      type: isAggregated ? 'aggregated' : edge.type,
      color: isAggregated ? neutralEdgeColor : edge.color,
      sourceLabel: edge.sourceLabel,
      targetLabel: edge.targetLabel,
    });
  }

  // Invisible "membership" tethers: keep each expanded group's members
  // clustered around the ghost via the link force. The renderer skips
  // drawing edges of type 'membership'.
  for (const n of simNodes) {
    if (n.kind !== 'bubble' || !n.isExpanded) continue;
    for (const memberId of n.memberIds) {
      if (!personToSimNode.has(memberId)) continue;
      const key = `${n.id}|${memberId}`;
      if (emitted.has(key)) continue;
      emitted.add(key);
      out.push({
        source: n.id,
        target: memberId,
        type: 'membership',
        color: neutralEdgeColor,
      });
    }
  }

  return out;
}
