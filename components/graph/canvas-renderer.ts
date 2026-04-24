// components/graph/canvas-renderer.ts
import type { ZoomTransform } from 'd3-zoom';
import type { SimulationEdge, SimulationNode, LODTier, PhotoCacheEntry } from './simulation-types';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  transform: ZoomTransform;
  width: number;
  height: number;
  lod: LODTier;
  isDark: boolean;
  isMobile: boolean;
  hoveredNodeId: string | null;
  getPhoto: (id: string) => PhotoCacheEntry | undefined;
}

const NODE_RADIUS = {
  desktop: { center: 12, normal: 8 },
  mobile:  { center: 10, normal: 7 },
} as const;

const FONT_SIZE = {
  desktop: { center: 14, normal: 12 },
  mobile:  { center: 12, normal: 10 },
} as const;

function nodeRadius(node: SimulationNode, isMobile: boolean): number {
  if (node.kind === 'bubble') {
    if (node.isExpanded) return isMobile ? 12 : 16;
    const base = isMobile ? 14 : 18;
    return Math.max(base, Math.min(isMobile ? 40 : 56, base * Math.sqrt(node.memberCount)));
  }
  const table = isMobile ? NODE_RADIUS.mobile : NODE_RADIUS.desktop;
  return node.isCenter ? table.center : table.normal;
}

function nodeFontSize(node: SimulationNode, isMobile: boolean): number {
  if (node.kind === 'bubble') return isMobile ? 11 : 13;
  const table = isMobile ? FONT_SIZE.mobile : FONT_SIZE.desktop;
  return node.isCenter ? table.center : table.normal;
}

function getNodeFill(node: SimulationNode, isDark: boolean): string {
  if (node.kind === 'bubble') return node.color ?? (isDark ? '#4b5563' : '#d1d5db');
  if (node.photo) return isDark ? '#000000' : '#ffffff';
  if (node.isCenter) return '#3B82F6';
  if (node.colors.length > 0) return node.colors[0];
  return '#9CA3AF';
}

function getNodeStroke(node: SimulationNode, isDark: boolean): string {
  if (node.kind === 'bubble') return node.color ?? (isDark ? '#9ca3af' : '#6b7280');
  if (node.colors.length > 0) return node.colors[0];
  if (node.isCenter) return '#3B82F6';
  return isDark ? '#ffffff' : '#1f2937';
}

function drawEdge(rc: RenderContext, edge: SimulationEdge, highlighted: boolean): void {
  const src = edge.source as SimulationNode;
  const tgt = edge.target as SimulationNode;
  if (src.x === undefined || tgt.x === undefined) return;

  rc.ctx.beginPath();
  rc.ctx.moveTo(src.x, src.y ?? 0);
  rc.ctx.lineTo(tgt.x, tgt.y ?? 0);
  rc.ctx.strokeStyle = edge.color || '#999';
  rc.ctx.globalAlpha = highlighted ? 0.8 : 0.15;
  rc.ctx.lineWidth = 2;
  rc.ctx.stroke();
  rc.ctx.globalAlpha = 1;

  if (highlighted) drawArrowMarker(rc, src, tgt, edge.color || '#999');
}

function drawArrowMarker(
  rc: RenderContext,
  src: SimulationNode,
  tgt: SimulationNode,
  color: string,
): void {
  if (src.x === undefined || tgt.x === undefined) return;
  const dx = (tgt.x ?? 0) - (src.x ?? 0);
  const dy = (tgt.y ?? 0) - (src.y ?? 0);
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  const ux = dx / len;
  const uy = dy / len;
  // Back off by the target node radius + a small gap
  const r = nodeRadius(tgt, rc.isMobile) + 6;
  const tipX = (tgt.x ?? 0) - ux * r;
  const tipY = (tgt.y ?? 0) - uy * r;
  const size = 6;
  const leftX = tipX - ux * size + uy * size * 0.5;
  const leftY = tipY - uy * size - ux * size * 0.5;
  const rightX = tipX - ux * size - uy * size * 0.5;
  const rightY = tipY - uy * size + ux * size * 0.5;
  rc.ctx.beginPath();
  rc.ctx.moveTo(tipX, tipY);
  rc.ctx.lineTo(leftX, leftY);
  rc.ctx.lineTo(rightX, rightY);
  rc.ctx.closePath();
  rc.ctx.fillStyle = color;
  rc.ctx.globalAlpha = 0.8;
  rc.ctx.fill();
  rc.ctx.globalAlpha = 1;
}

function drawNode(rc: RenderContext, node: SimulationNode): void {
  if (node.x === undefined || node.y === undefined) return;
  const r = nodeRadius(node, rc.isMobile);

  rc.ctx.beginPath();
  rc.ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  rc.ctx.fillStyle = getNodeFill(node, rc.isDark);
  rc.ctx.fill();

  if (rc.lod !== 'dots') {
    rc.ctx.lineWidth = 2;
    rc.ctx.strokeStyle = getNodeStroke(node, rc.isDark);
    rc.ctx.stroke();
  }

  if (rc.lod === 'full' && node.kind === 'person' && node.photo) {
    const entry = rc.getPhoto(node.id);
    if (entry && entry !== 'loading' && entry !== 'error') {
      rc.ctx.save();
      rc.ctx.beginPath();
      rc.ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      rc.ctx.clip();
      rc.ctx.drawImage(entry, node.x - r, node.y - r, r * 2, r * 2);
      rc.ctx.restore();
    }
  }
}

function drawLabel(rc: RenderContext, node: SimulationNode, color: string): void {
  if (node.kind !== 'person') return;  // bubble labels are drawn inside drawBubble in Task 20
  if (node.x === undefined || node.y === undefined) return;
  const r = nodeRadius(node, rc.isMobile);
  const fontSize = nodeFontSize(node, rc.isMobile);
  rc.ctx.font = `${node.isCenter ? '600 ' : ''}${fontSize}px system-ui, -apple-system, sans-serif`;
  rc.ctx.fillStyle = color;
  rc.ctx.textAlign = 'center';
  rc.ctx.textBaseline = 'top';
  const dy = node.isCenter ? (rc.isMobile ? 14 : 17) : (rc.isMobile ? 12 : 14);
  rc.ctx.fillText(node.label, node.x, (node.y ?? 0) + r + dy - r);
}

export function paintFrame(
  rc: RenderContext,
  nodes: SimulationNode[],
  edges: SimulationEdge[],
): void {
  rc.ctx.save();
  rc.ctx.clearRect(0, 0, rc.width, rc.height);

  // Apply zoom transform so node coordinates are graph-space
  rc.ctx.translate(rc.transform.x, rc.transform.y);
  rc.ctx.scale(rc.transform.k, rc.transform.k);

  // Draw non-highlighted edges first
  const highlightedEdgeSources = new Set<string>();
  if (rc.hoveredNodeId) {
    for (const e of edges) {
      const srcId = typeof e.source === 'string' ? e.source : e.source.id;
      if (srcId === rc.hoveredNodeId) highlightedEdgeSources.add(srcId);
    }
  }

  for (const e of edges) {
    const srcId = typeof e.source === 'string' ? e.source : e.source.id;
    const highlighted = srcId === rc.hoveredNodeId;
    if (!highlighted) drawEdge(rc, e, false);
  }
  for (const e of edges) {
    const srcId = typeof e.source === 'string' ? e.source : e.source.id;
    if (srcId === rc.hoveredNodeId) drawEdge(rc, e, true);
  }

  // Nodes above edges
  for (const node of nodes) drawNode(rc, node);

  if (rc.lod !== 'dots') {
    const labelColor = rc.isDark ? '#f3f4f6' : '#111827';
    for (const node of nodes) drawLabel(rc, node, labelColor);
  }

  rc.ctx.restore();
}
