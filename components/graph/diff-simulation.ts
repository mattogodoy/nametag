import type { SimulationEdge, SimulationNode } from './simulation-types';

function getEndpointId(v: string | SimulationNode): string {
  return typeof v === 'string' ? v : v.id;
}

export function diffSimulationData(
  previousNodes: SimulationNode[],
  incomingNodes: SimulationNode[],
  _previousEdges: SimulationEdge[],
  incomingEdges: SimulationEdge[],
): { nodes: SimulationNode[]; edges: SimulationEdge[] } {
  const prevById = new Map(previousNodes.map((n) => [n.id, n]));

  const mergedNodes: SimulationNode[] = incomingNodes.map((incoming) => {
    const prev = prevById.get(incoming.id);
    if (prev) {
      return {
        ...incoming,
        x: prev.x,
        y: prev.y,
        vx: prev.vx,
        vy: prev.vy,
        fx: prev.fx,
        fy: prev.fy,
      };
    }
    return incoming;
  });

  const retainedIds = new Set(mergedNodes.map((n) => n.id));
  const edges = incomingEdges.filter(
    (e) => retainedIds.has(getEndpointId(e.source)) && retainedIds.has(getEndpointId(e.target)),
  );

  // Seed positions for newly-added nodes based on connected retained nodes.
  const mergedById = new Map(mergedNodes.map((n) => [n.id, n]));
  for (const node of mergedNodes) {
    if (node.x !== undefined && node.y !== undefined) continue;

    const neighbors: SimulationNode[] = [];
    for (const edge of edges) {
      const srcId = getEndpointId(edge.source);
      const tgtId = getEndpointId(edge.target);
      if (srcId === node.id) {
        const n = mergedById.get(tgtId);
        if (n && n.x !== undefined && n.y !== undefined) neighbors.push(n);
      } else if (tgtId === node.id) {
        const n = mergedById.get(srcId);
        if (n && n.x !== undefined && n.y !== undefined) neighbors.push(n);
      }
    }

    if (neighbors.length > 0) {
      node.x = neighbors.reduce((s, n) => s + (n.x ?? 0), 0) / neighbors.length;
      node.y = neighbors.reduce((s, n) => s + (n.y ?? 0), 0) / neighbors.length;
    } else {
      node.x = 0;
      node.y = 0;
    }
  }

  return { nodes: mergedNodes, edges };
}
