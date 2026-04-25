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
  formatEdgeLabel?: (edge: SimulationEdge) => EdgeLabelParts;
}

export interface EdgeLabelParts {
  before: string;
  emphasis: string;
  after: string;
}

const NODE_RADIUS = {
  desktop: { center: 12, normal: 8 },
  mobile:  { center: 10, normal: 7 },
} as const;

const FONT_SIZE = {
  desktop: { center: 14, normal: 12 },
  mobile:  { center: 12, normal: 10 },
} as const;

const BUBBLE_RADIUS = { desktop: 14, mobile: 12 } as const;

function nodeRadius(node: SimulationNode, isMobile: boolean): number {
  if (node.kind === 'bubble') {
    return isMobile ? BUBBLE_RADIUS.mobile : BUBBLE_RADIUS.desktop;
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
  // Back off by exactly the target node radius so the arrow tip touches the node.
  const r = nodeRadius(tgt, rc.isMobile);
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

function drawBubble(rc: RenderContext, node: SimulationNode): void {
  if (node.kind !== 'bubble') return;
  if (node.x === undefined || node.y === undefined) return;
  const r = nodeRadius(node, rc.isMobile);
  const ringColor = getNodeStroke(node, rc.isDark);
  const tintColor = node.color ?? (rc.isDark ? '#9ca3af' : '#6b7280');

  // Hollow ring with a faint group-color tint inside, count rendered in middle.
  rc.ctx.beginPath();
  rc.ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  rc.ctx.fillStyle = tintColor;
  rc.ctx.globalAlpha = node.isExpanded ? 0.06 : 0.15;
  rc.ctx.fill();
  rc.ctx.globalAlpha = 1;

  rc.ctx.beginPath();
  rc.ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  rc.ctx.lineWidth = 2.5;
  rc.ctx.strokeStyle = ringColor;
  rc.ctx.globalAlpha = node.isExpanded ? 0.4 : 1;
  rc.ctx.stroke();
  rc.ctx.globalAlpha = 1;

  if (rc.lod !== 'dots') {
    // Count inscribed in the ring
    const countFont = `600 ${rc.isMobile ? 9 : 10}px system-ui, -apple-system, sans-serif`;
    rc.ctx.font = countFont;
    rc.ctx.fillStyle = rc.isDark ? '#f3f4f6' : '#111827';
    rc.ctx.globalAlpha = node.isExpanded ? 0.5 : 1;
    rc.ctx.textAlign = 'center';
    rc.ctx.textBaseline = 'middle';
    rc.ctx.fillText(String(node.memberCount), node.x, node.y);
    rc.ctx.globalAlpha = 1;

    // Group name label below, like a person's name
    const labelFont = `${rc.isMobile ? 11 : 12}px system-ui, -apple-system, sans-serif`;
    rc.ctx.font = labelFont;
    rc.ctx.fillStyle = rc.isDark ? '#f3f4f6' : '#111827';
    rc.ctx.globalAlpha = node.isExpanded ? 0.5 : 1;
    rc.ctx.textAlign = 'center';
    rc.ctx.textBaseline = 'top';
    const labelOnly = node.label.split(' · ')[0];
    rc.ctx.fillText(labelOnly, node.x, node.y + r + (rc.isMobile ? 5 : 6));
    rc.ctx.globalAlpha = 1;
  }
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

  // Edge labels for highlighted edges
  if (rc.hoveredNodeId && rc.formatEdgeLabel && rc.lod !== 'dots') {
    const fontSize = rc.isMobile ? 10 : 11;
    const fontFamily = 'system-ui, -apple-system, sans-serif';
    const normalFont = `${fontSize}px ${fontFamily}`;
    const boldFont = `700 ${fontSize}px ${fontFamily}`;
    rc.ctx.textAlign = 'left';
    rc.ctx.textBaseline = 'middle';
    for (const e of edges) {
      const srcId = typeof e.source === 'string' ? e.source : e.source.id;
      if (srcId !== rc.hoveredNodeId) continue;
      const src = e.source as SimulationNode;
      const tgt = e.target as SimulationNode;
      if (src.x === undefined || tgt.x === undefined) continue;
      const mx = ((src.x ?? 0) + (tgt.x ?? 0)) / 2;
      const my = ((src.y ?? 0) + (tgt.y ?? 0)) / 2;
      const parts = rc.formatEdgeLabel(e);

      rc.ctx.font = normalFont;
      const wBefore = rc.ctx.measureText(parts.before).width;
      const wAfter = rc.ctx.measureText(parts.after).width;
      rc.ctx.font = boldFont;
      const wEmph = rc.ctx.measureText(parts.emphasis).width;
      const totalW = wBefore + wEmph + wAfter;

      const padX = 6;
      const padY = 2;
      const w = totalW + padX * 2;
      const h = fontSize + padY * 2;
      rc.ctx.fillStyle = rc.isDark ? 'rgba(17,24,39,0.55)' : 'rgba(255,255,255,0.65)';
      rc.ctx.fillRect(mx - w / 2, my - h / 2, w, h);

      const baseX = mx - totalW / 2;
      const textColor = e.color || (rc.isDark ? '#f3f4f6' : '#111827');
      rc.ctx.fillStyle = textColor;
      rc.ctx.font = normalFont;
      rc.ctx.fillText(parts.before, baseX, my);
      rc.ctx.font = boldFont;
      rc.ctx.fillText(parts.emphasis, baseX + wBefore, my);
      rc.ctx.font = normalFont;
      rc.ctx.fillText(parts.after, baseX + wBefore + wEmph, my);
    }
  }

  // Nodes above edges
  for (const node of nodes) {
    if (node.kind === 'bubble') drawBubble(rc, node);
    else drawNode(rc, node);
  }

  if (rc.lod !== 'dots') {
    const labelColor = rc.isDark ? '#f3f4f6' : '#111827';
    for (const node of nodes) {
      if (node.kind === 'person') drawLabel(rc, node, labelColor);
    }
  }

  rc.ctx.restore();
}
