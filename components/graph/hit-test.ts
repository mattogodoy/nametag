import { quadtree, type Quadtree } from 'd3-quadtree';
import type { SimulationNode } from './simulation-types';

export type NodeQuadtree = Quadtree<SimulationNode>;

export function buildQuadtree(nodes: SimulationNode[]): NodeQuadtree {
  const positioned = nodes.filter(
    (n): n is SimulationNode & { x: number; y: number } =>
      typeof n.x === 'number' && typeof n.y === 'number',
  );
  return quadtree<SimulationNode>()
    .x((n) => n.x ?? 0)
    .y((n) => n.y ?? 0)
    .addAll(positioned);
}

export function findNodeAtPoint(
  tree: NodeQuadtree,
  x: number,
  y: number,
  radius: number,
): SimulationNode | undefined {
  return tree.find(x, y, radius);
}
