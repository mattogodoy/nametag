import type { SimulationEdge, SimulationNode } from './simulation-types';

export interface BuildEdgesArgs {
  rawEdges: SimulationEdge[];
  simNodes: SimulationNode[];
  centerNodeId: string;
  neutralEdgeColor: string;
}

export function buildHubAndSpokeEdges(args: BuildEdgesArgs): SimulationEdge[] {
  const { rawEdges, simNodes, centerNodeId, neutralEdgeColor } = args;

  // Map person id → the sim-node id that represents them (themselves or a non-expanded bubble).
  // Expanded (ghost) bubbles are NOT included: members are present as their own person nodes.
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

    // Only keep edges incident to the center
    if (srcSim !== centerNodeId && tgtSim !== centerNodeId) continue;

    const srcIsBubble = srcSim.startsWith('bubble:');
    const tgtIsBubble = tgtSim.startsWith('bubble:');
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

  // Tether each expanded ghost bubble to its members so they cluster around
  // the ghost in the simulation instead of drifting away from the graph.
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
