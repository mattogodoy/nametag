'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  forceSimulation, forceLink, forceManyBody, forceCenter,
  forceCollide, forceX, forceY, type Simulation,
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomTransform, type ZoomBehavior } from 'd3-zoom';
import { drag } from 'd3-drag';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import PillSelector from './PillSelector';
import { GraphFilterGroupPill } from './GraphFilterPills';
import { paintFrame } from './graph/canvas-renderer';
import { getLODTier } from './graph/lod';
import { getCachedPhoto, loadPhoto } from './graph/photo-cache';
import { buildQuadtree, findNodeAtPoint, type NodeQuadtree } from './graph/hit-test';
import { diffSimulationData } from './graph/diff-simulation';
import { resolveGraphMode } from './graph/mode-resolution';
import { buildSimulationNodes, type RawGraphPerson } from './graph/bubble-composition';
import { buildHubAndSpokeEdges } from './graph/edge-composition';
import { UNGROUPED_SYNTHETIC_ID } from './graph/simulation-types';
import type { SimulationNode, SimulationEdge } from './graph/simulation-types';

// Props interface — unchanged from pre-rewrite file
interface Group { id: string; name: string; color: string | null; }
type IncludeMode = 'or' | 'and';
type GroupFilterItem = { id: string; label: string; color: string | null; isNegative: boolean; };

interface UnifiedNetworkGraphProps {
  apiEndpoint?: string;
  groups?: Group[];
  centerNodeNonClickable?: boolean;
  linkDistance?: number;
  chargeStrength?: number;
  refreshKey?: number;
  graphMode?: 'individuals' | 'bubbles' | null;
}

export default function UnifiedNetworkGraph({
  apiEndpoint,
  groups,
  centerNodeNonClickable = false,
  linkDistance = 160,
  chargeStrength = -400,
  refreshKey,
  graphMode: graphModeProp = null,
}: UnifiedNetworkGraphProps) {
  const t = useTranslations('dashboard.graph');
  const tPeople = useTranslations('people');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();

  // Simulation state
  const simRef = useRef<Simulation<SimulationNode, SimulationEdge> | null>(null);
  const nodesRef = useRef<SimulationNode[]>([]);
  const edgesRef = useRef<SimulationEdge[]>([]);
  const quadtreeRef = useRef<NodeQuadtree | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const zoomBehaviorRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const dirtyRef = useRef<boolean>(false);
  const rafRef = useRef<number | null>(null);
  const unpinTimeoutRef = useRef<number | null>(null);

  // Filter state
  const [selectedGroupFilters, setSelectedGroupFilters] = useState<GroupFilterItem[]>([]);
  const [includeMode, setIncludeMode] = useState<IncludeMode>('or');
  const [isMobile, setIsMobile] = useState(false);
  const capitalizeType = useLocale().startsWith('de');

  // Bubble state
  const [expandedBubbles, setExpandedBubbles] = useState<Set<string>>(new Set());
  const [localGraphMode, setLocalGraphMode] = useState<'individuals' | 'bubbles' | null>(graphModeProp);
  const rawCacheRef = useRef<{ nodes: RawGraphPerson[]; edges: SimulationEdge[] } | null>(null);

  // Ungrouped label for bubble composition
  const ungroupedLabel = t('unsortedBubbleLabel');

  const includeGroupIds = useMemo(
    () => selectedGroupFilters.filter((f) => !f.isNegative).map((f) => f.id),
    [selectedGroupFilters],
  );
  const excludeGroupIds = useMemo(
    () => selectedGroupFilters.filter((f) => f.isNegative).map((f) => f.id),
    [selectedGroupFilters],
  );

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Re-center the graph view
  const recenterGraph = useCallback(() => {
    const canvas = canvasRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!canvas || !zoomBehavior) return;
    select(canvas)
      .transition()
      .duration(750)
      .call(zoomBehavior.transform, zoomIdentity);
  }, []);

  const toggleFilterSign = (id: string) => {
    setSelectedGroupFilters((prev) =>
      prev.map((filter) =>
        filter.id === id
          ? { ...filter, isNegative: !filter.isNegative }
          : filter,
      ),
    );
  };

  const requestPaint = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const formatEdgeLabel = useCallback((edge: SimulationEdge) => {
    if (edge.type === 'aggregated' || edge.type === 'membership') {
      return { before: '', emphasis: '', after: '' };
    }
    const youLabel = tPeople('you');
    const sourceName = edge.sourceLabel ?? '';
    const targetName = edge.targetLabel ?? '';
    const typeStr = capitalizeType
      ? edge.type.charAt(0).toUpperCase() + edge.type.slice(1)
      : edge.type.toLowerCase();
    let full: string;
    if (sourceName === youLabel || sourceName === 'You') {
      full = tPeople('graphEdgeLabelFromYou', { type: typeStr });
    } else if (targetName === youLabel || targetName === 'You') {
      full = tPeople('graphEdgeLabelToYou', { type: typeStr });
    } else {
      full = tPeople('graphEdgeLabel', { type: typeStr });
    }
    const idx = full.toLowerCase().indexOf(typeStr.toLowerCase());
    if (idx < 0) return { before: full, emphasis: '', after: '' };
    return {
      before: full.substring(0, idx),
      emphasis: full.substring(idx, idx + typeStr.length),
      after: full.substring(idx + typeStr.length),
    };
  }, [tPeople, capitalizeType]);

  // Step 1: Paint loop
  const runPaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Keep backing store in sync with CSS size and DPR.
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const wantW = Math.floor(rect.width * dpr);
    const wantH = Math.floor(rect.height * dpr);
    if (canvas.width !== wantW || canvas.height !== wantH) {
      canvas.width = wantW;
      canvas.height = wantH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const transform = transformRef.current;
    const lod = getLODTier(transform.k);
    const isDark = document.documentElement.classList.contains('dark');

    // Request photos for nodes that will render at full LOD and are in viewport.
    if (lod === 'full') {
      const padPx = 64;
      for (const node of nodesRef.current) {
        if (node.kind !== 'person') continue;
        if (!node.photo) continue;
        if (node.x === undefined || node.y === undefined) continue;
        const screenX = node.x * transform.k + transform.x;
        const screenY = node.y * transform.k + transform.y;
        if (
          screenX < -padPx || screenX > rect.width + padPx ||
          screenY < -padPx || screenY > rect.height + padPx
        ) continue;
        const src = node.id.startsWith('user-')
          ? '/api/photos/user'
          : `/api/photos/${node.id}`;
        loadPhoto(node.id, src, requestPaint);
      }
    }

    paintFrame(
      {
        ctx,
        transform,
        width: rect.width,
        height: rect.height,
        lod,
        isDark,
        isMobile,
        hoveredNodeId: hoveredNodeIdRef.current,
        getPhoto: getCachedPhoto,
        formatEdgeLabel,
      },
      nodesRef.current,
      edgesRef.current,
    );
  }, [isMobile, requestPaint, formatEdgeLabel]);

  useEffect(() => {
    const tick = () => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        runPaint();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [runPaint]);

  // Step 2: Simulation builder
  const buildSimulation = useCallback((nodes: SimulationNode[], edges: SimulationEdge[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mobileLinkDistance = isMobile ? 110 : linkDistance;
    const mobileChargeStrength = isMobile ? -250 : chargeStrength;
    const personCollisionR = isMobile ? 38 : 52;

    // Visible-radius-aware collision so bubbles don't overlap "you" or each other.
    const collisionForNode = (d: SimulationNode): number => {
      if (d.kind === 'bubble') return (isMobile ? 12 : 14) + (isMobile ? 18 : 28);
      return personCollisionR;
    };

    const membershipLinkDistance = isMobile ? 22 : 32;
    const aggregatedLinkDistance = isMobile ? 150 : 220;

    // Custom force: each expanded ghost behaves like an "invisible big bubble".
    // Members get strongly pulled toward the ghost (orbiting close to it);
    // non-members get pushed out of the ghost's domain so the cluster reads
    // as a coherent island.
    const expandedClusterField = (() => {
      const tightenStrength = 0.35;
      const repelStrength = 0.5;
      const padding = isMobile ? 18 : 24;
      const memberRadius = isMobile ? 12 : 14;
      let attached: SimulationNode[] = [];
      const memberToGhostId = new Map<string, string>();

      const force = (alpha: number) => {
        // Build per-ghost domain (ghost position + radius + member set + protected ids)
        type Domain = { ghostId: string; x: number; y: number; r: number; protectedIds: Set<string> };
        const domains: Domain[] = [];
        for (const n of attached) {
          if (n.kind !== 'bubble' || !n.isExpanded || n.x === undefined) continue;
          const r = Math.sqrt(Math.max(n.memberCount, 1)) * memberRadius * 1.2 + padding;
          const protectedIds = new Set<string>([n.id, ...n.memberIds]);
          domains.push({ ghostId: n.id, x: n.x, y: n.y ?? 0, r, protectedIds });
        }
        if (domains.length === 0) return;

        // Tighten each expanded member toward its ghost
        for (const node of attached) {
          if (node.kind !== 'person') continue;
          const ghostId = memberToGhostId.get(node.id);
          if (!ghostId) continue;
          const dom = domains.find((d) => d.ghostId === ghostId);
          if (!dom || node.x === undefined) continue;
          const dx = dom.x - (node.x ?? 0);
          const dy = dom.y - (node.y ?? 0);
          node.vx = (node.vx ?? 0) + dx * tightenStrength * alpha;
          node.vy = (node.vy ?? 0) + dy * tightenStrength * alpha;
        }

        // Push non-members out of each domain
        for (const dom of domains) {
          for (const node of attached) {
            if (dom.protectedIds.has(node.id)) continue;
            if (node.x === undefined) continue;
            const dx = (node.x ?? 0) - dom.x;
            const dy = (node.y ?? 0) - dom.y;
            const d = Math.hypot(dx, dy);
            if (d > 0 && d < dom.r) {
              const push = ((dom.r - d) / dom.r) * repelStrength * alpha;
              node.vx = (node.vx ?? 0) + (dx / d) * push * dom.r;
              node.vy = (node.vy ?? 0) + (dy / d) * push * dom.r;
            }
          }
        }
      };

      force.initialize = (n: SimulationNode[]) => {
        attached = n;
        memberToGhostId.clear();
        for (const node of n) {
          if (node.kind === 'bubble' && node.isExpanded) {
            for (const memberId of node.memberIds) {
              memberToGhostId.set(memberId, node.id);
            }
          }
        }
      };

      return force;
    })();

    const sim = forceSimulation<SimulationNode>(nodes)
      .velocityDecay(0.6)
      .force('link', forceLink<SimulationNode, SimulationEdge>(edges)
        .id((d) => d.id)
        .distance((e) => {
          if (e.type === 'membership') return membershipLinkDistance;
          if (e.type === 'aggregated') return aggregatedLinkDistance;
          return mobileLinkDistance;
        })
        .strength((e) => e.type === 'membership' ? 0.4 : 1))
      .force('charge', forceManyBody().strength(mobileChargeStrength))
      .force('center', forceCenter(width / 2, height / 2))
      // Stronger pull for "you" anchors it at canvas-center under normal forces,
      // while still letting the user drag it around for fun.
      .force('centerX', forceX<SimulationNode>(width / 2).strength((d) => {
        if (d.kind === 'person' && d.isCenter) return 0.5;
        if (d.kind === 'bubble' && d.isExpanded) return 0;
        return 0.15;
      }))
      .force('centerY', forceY<SimulationNode>(height / 2).strength((d) => {
        if (d.kind === 'person' && d.isCenter) return 0.5;
        if (d.kind === 'bubble' && d.isExpanded) return 0;
        return 0.15;
      }))
      .force('collision', forceCollide<SimulationNode>().radius(collisionForNode))
      .force('expandedCluster', expandedClusterField);

    sim.on('tick', () => {
      quadtreeRef.current = buildQuadtree(nodes);
      requestPaint();
    });

    return sim;
  }, [isMobile, linkDistance, chargeStrength, requestPaint]);

  // Step 3: Composition helper — recomposes sim data from raw cache
  const recomposeAndBuildSim = useCallback((raw: { nodes: RawGraphPerson[]; edges: SimulationEdge[] }) => {
    const incomingPeople = raw.nodes;

    // If no groups prop, we're not on the dashboard — skip bubble logic.
    const resolvedMode = groups ? resolveGraphMode(localGraphMode) : 'individuals';

    // Always expand any group that's currently in the include filter.
    const nextExpanded = new Set(expandedBubbles);
    if (resolvedMode === 'bubbles' && groups) {
      for (const id of includeGroupIds) {
        nextExpanded.add(id);
      }
    }

    // Drop expanded groups that no longer exist in the current data.
    if (resolvedMode === 'bubbles' && groups) {
      const presentGroups = new Set(groups.map((g) => g.id));
      presentGroups.add(UNGROUPED_SYNTHETIC_ID);
      for (const id of [...nextExpanded]) {
        if (!presentGroups.has(id)) nextExpanded.delete(id);
      }
    }
    if (nextExpanded.size !== expandedBubbles.size) {
      setExpandedBubbles(nextExpanded);
    }

    const incomingNodes = buildSimulationNodes({
      people: incomingPeople,
      groups: groups ?? [],
      mode: resolvedMode,
      expandedBubbles: nextExpanded,
      ungroupedLabel,
    });

    const rawEdges: SimulationEdge[] = raw.edges;
    const incomingEdges = resolvedMode === 'bubbles'
      ? buildHubAndSpokeEdges({
          rawEdges,
          simNodes: incomingNodes,
          neutralEdgeColor: '#9ca3af',
        })
      : rawEdges;

    const { nodes, edges } = diffSimulationData(nodesRef.current, incomingNodes, edgesRef.current, incomingEdges);
    nodesRef.current = nodes;
    edgesRef.current = edges;

    simRef.current?.stop();
    const sim = buildSimulation(nodes, edges);
    if (sim) {
      sim.alpha(0.3).restart();
      simRef.current = sim;
    }
  }, [
    groups, localGraphMode, expandedBubbles,
    includeGroupIds, ungroupedLabel, buildSimulation,
  ]);

  // Step 4: Data-fetch effect
  useEffect(() => {
    if (!canvasRef.current || !apiEndpoint) return;

    let cancelled = false;

    const fetchData = async () => {
      const url = new URL(apiEndpoint, window.location.origin);
      url.searchParams.set('groupMatchOperator', includeMode);
      if (includeGroupIds.length > 0) url.searchParams.set('includeGroupIds', includeGroupIds.join(','));
      if (excludeGroupIds.length > 0) url.searchParams.set('excludeGroupIds', excludeGroupIds.join(','));

      const response = await fetch(url.toString());
      const data = await response.json() as { nodes: RawGraphPerson[]; edges: SimulationEdge[] };

      if (cancelled) return;

      rawCacheRef.current = data;
      recomposeAndBuildSim(data);
    };

    fetchData();
    return () => { cancelled = true; };
    // recomposeAndBuildSim intentionally excluded: it depends on bubble state
    // (expandedBubbles, localGraphMode) which are handled by the Step 5 effect
    // from the cached raw data — no need to re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiEndpoint, refreshKey, includeMode, includeGroupIds, excludeGroupIds]);

  // Step 5: Recompose when bubble state changes (mode toggle, expand/collapse)
  useEffect(() => {
    const raw = rawCacheRef.current;
    if (!raw) return;
    recomposeAndBuildSim(raw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localGraphMode, expandedBubbles]);

  // Step 6: Zoom, click, hover, and drag handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toGraphCoords = (clientX: number, clientY: number): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      const xPx = clientX - rect.left;
      const yPx = clientY - rect.top;
      const t = transformRef.current;
      return [(xPx - t.x) / t.k, (yPx - t.y) / t.k];
    };

    const nodeAt = (clientX: number, clientY: number): SimulationNode | undefined => {
      const tree = quadtreeRef.current;
      if (!tree) return undefined;
      const [gx, gy] = toGraphCoords(clientX, clientY);
      return findNodeAtPoint(tree, gx, gy, isMobile ? 18 : 22);
    };

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 3])
      .filter((event: Event) => {
        const me = event as MouseEvent;
        if (me.ctrlKey || me.button) return false;
        if (event.type === 'mousedown' || event.type === 'touchstart') {
          const touch = 'touches' in event ? (event as TouchEvent).touches[0] : null;
          const cx = touch ? touch.clientX : me.clientX;
          const cy = touch ? touch.clientY : me.clientY;
          if (nodeAt(cx, cy)) return false;
        }
        return true;
      })
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        requestPaint();
      });
    zoomBehaviorRef.current = zoomBehavior;
    select(canvas).call(zoomBehavior);

    const onMove = (event: MouseEvent) => {
      const node = nodeAt(event.clientX, event.clientY);
      const id = node?.id ?? null;
      if (hoveredNodeIdRef.current !== id) {
        hoveredNodeIdRef.current = id;
        canvas.style.cursor = id ? 'pointer' : 'default';
        requestPaint();
      }
    };

    const handleNodeActivate = (node: SimulationNode) => {
      if (node.kind === 'bubble') {
        // Collapse is instant.
        if (node.isExpanded) {
          setExpandedBubbles((prev) => {
            const next = new Set(prev);
            next.delete(node.groupId);
            return next;
          });
          return;
        }
        // Expand: push the bubble outward, pin it, reheat the sim so other
        // nodes redistribute, wait briefly, THEN trigger expansion so the
        // cluster lands in cleared space.
        if (node.x !== undefined && node.y !== undefined) {
          const center = nodesRef.current.find(
            (n): n is SimulationNode & { x: number; y: number } =>
              n.kind === 'person' && n.isCenter && n.x !== undefined && n.y !== undefined,
          );
          if (center) {
            const dx = node.x - center.x;
            const dy = node.y - center.y;
            const dist = Math.hypot(dx, dy) || 1;
            const memberRadius = isMobile ? 12 : 14;
            const padding = isMobile ? 18 : 24;
            const clusterRadius = Math.sqrt(Math.max(node.memberCount, 1)) * memberRadius * 1.2 + padding;
            const targetDist = (clusterRadius + (isMobile ? 130 : 180)) * 2;
            const finalDist = Math.max(dist, targetDist);
            const ratio = finalDist / dist;
            const targetX = center.x + dx * ratio;
            const targetY = center.y + dy * ratio;

            node.x = targetX;
            node.y = targetY;
            node.fx = targetX;
            node.fy = targetY;
            node.vx = 0;
            node.vy = 0;
            if (simRef.current) simRef.current.alpha(0.3).restart();

            const bubbleId = node.id;
            const groupId = node.groupId;

            setExpandedBubbles((prev) => {
              const next = new Set(prev);
              next.add(groupId);
              return next;
            });
            // Release the pin once the cluster has had time to settle. With
            // centerX/Y strength = 0 for expanded ghosts, it stays put.
            if (unpinTimeoutRef.current !== null) window.clearTimeout(unpinTimeoutRef.current);
            unpinTimeoutRef.current = window.setTimeout(() => {
              unpinTimeoutRef.current = null;
              const ghost = nodesRef.current.find((n) => n.id === bubbleId);
              if (ghost) {
                ghost.fx = null;
                ghost.fy = null;
              }
            }, 1500);
          }
        }
        return;
      }
      if (centerNodeNonClickable && node.isCenter) return;
      if (node.id.startsWith('user-')) router.push('/dashboard');
      else router.push(`/people/${node.id}`);
    };

    let dragStartX = 0;
    let dragStartY = 0;
    const CLICK_TRAVEL_PX = 4;

    const drag_ = drag<HTMLCanvasElement, unknown>()
      .container(canvas)
      .subject((event) => {
        const node = nodeAt(event.sourceEvent.clientX, event.sourceEvent.clientY);
        return node ?? null;
      })
      .on('start', (event) => {
        const d = event.subject as SimulationNode | null;
        if (!d) return;
        dragStartX = event.x;
        dragStartY = event.y;
        if (!event.active && simRef.current) simRef.current.alphaTarget(0.1).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event) => {
        const d = event.subject as SimulationNode | null;
        if (!d) return;
        const [gx, gy] = toGraphCoords(event.sourceEvent.clientX, event.sourceEvent.clientY);
        d.fx = gx;
        d.fy = gy;
      })
      .on('end', (event) => {
        const d = event.subject as SimulationNode | null;
        if (!d) return;
        if (!event.active && simRef.current) simRef.current.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        const traveled = Math.hypot(event.x - dragStartX, event.y - dragStartY);
        if (traveled < CLICK_TRAVEL_PX) handleNodeActivate(d);
      });

    select(canvas).call(drag_);

    canvas.addEventListener('mousemove', onMove);

    return () => {
      canvas.removeEventListener('mousemove', onMove);
      select(canvas).on('.zoom', null);
      select(canvas).on('.drag', null);
      if (unpinTimeoutRef.current !== null) {
        window.clearTimeout(unpinTimeoutRef.current);
        unpinTimeoutRef.current = null;
      }
    };
  }, [centerNodeNonClickable, isMobile, requestPaint, router]);

  return (
    <div className="w-full h-full">
      {groups && (
        <div className="mb-4 space-y-2">
          <div className="flex items-stretch gap-3">
            <div className="shrink-0">
              <label className="flex h-full items-center text-sm placeholder-muted">
                <span
                  className="inline-flex h-full items-stretch rounded-md border border-border bg-surface-elevated p-0.5 focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setIncludeMode((prev) => (prev === 'or' ? 'and' : 'or'))
                    }
                    className="inline-flex h-full px-3 items-center justify-center whitespace-nowrap text-base font-normal rounded border border-transparent text-foreground transition-all hover:bg-surface focus:outline-none"
                    aria-label={t('matchMode.ariaLabel', {
                      title:
                        includeMode === 'or'
                          ? t('matchMode.anyTitle')
                          : t('matchMode.allTitle'),
                    })}
                    title={
                      includeMode === 'or'
                        ? t('matchMode.anyTitle')
                        : t('matchMode.allTitle')
                    }
                  >
                    {includeMode === 'or'
                      ? t('matchMode.any')
                      : t('matchMode.all')}
                  </button>
                </span>
              </label>
            </div>

            <div className="flex-1">
              <PillSelector<GroupFilterItem>
                selectedItems={selectedGroupFilters}
                availableItems={groups.map((g) => ({
                  id: g.id,
                  label: g.name,
                  color: g.color,
                  isNegative: false,
                }))}
                onAdd={(item) => {
                  setSelectedGroupFilters((prev) =>
                    prev.some((f) => f.id === item.id)
                      ? prev
                      : [...prev, { ...item, isNegative: false }],
                  );
                }}
                onRemove={(itemId) =>
                  setSelectedGroupFilters((prev) =>
                    prev.filter((f) => f.id !== itemId),
                  )
                }
                onClearAll={() => setSelectedGroupFilters([])}
                placeholder={t('filterPlaceholder')}
                emptyMessage={t('noGroupsFound')}
                showAllOnFocus={true}
                renderPill={(item, onRemove) => (
                  <GraphFilterGroupPill
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    color={item.color}
                    isNegative={item.isNegative}
                    onToggle={() => toggleFilterSign(item.id)}
                    onRemove={onRemove}
                    title={
                      item.isNegative
                        ? t('filterState.excluded')
                        : t('filterState.included')
                    }
                    ariaLabel={
                      item.isNegative
                        ? t('filterState.excludedWithLabel', {
                            label: item.label,
                          })
                        : t('filterState.includedWithLabel', {
                            label: item.label,
                          })
                    }
                  />
                )}
              />
            </div>
          </div>
        </div>
      )}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full h-[400px] sm:h-[500px] lg:h-[600px] bg-surface rounded-lg border border-border"
        />
        <div className="absolute bottom-4 right-4 flex gap-2">
          {groups && (() => {
            const bubblesActive = resolveGraphMode(localGraphMode) === 'bubbles';
            const label = bubblesActive ? t('showIndividuals') : t('showAsGroups');
            return (
              <>
                <button
                  onClick={async () => {
                    const next: 'individuals' | 'bubbles' = bubblesActive ? 'individuals' : 'bubbles';
                    setLocalGraphMode(next);
                    try {
                      await fetch('/api/user/graph-display', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ graphMode: next }),
                      });
                    } catch {
                      // Silent fail — local state is source of truth until next page load.
                    }
                  }}
                  className={`p-3 border rounded-lg transition-colors ${
                    bubblesActive
                      ? 'bg-primary/20 border-primary/40 dark:bg-primary dark:border-primary'
                      : 'bg-surface border-border hover:bg-surface-elevated'
                  }`}
                  aria-label={label}
                  title={label}
                >
                  <svg className="w-5 h-5 text-primary dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="8" cy="8" r="4" strokeWidth="2"/>
                    <circle cx="16" cy="16" r="4" strokeWidth="2"/>
                  </svg>
                </button>
                {bubblesActive && expandedBubbles.size > 0 && (
                  <button
                    onClick={() => setExpandedBubbles(new Set())}
                    className="p-3 bg-surface border border-border rounded-lg hover:bg-surface-elevated transition-colors"
                    aria-label={t('collapseAllGroups')}
                    title={t('collapseAllGroups')}
                  >
                    <svg
                      className="w-5 h-5 text-primary dark:text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <polyline points="4 14 10 14 10 20" />
                      <polyline points="20 10 14 10 14 4" />
                      <line x1="14" y1="10" x2="21" y2="3" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  </button>
                )}
              </>
            );
          })()}
          <button
            onClick={recenterGraph}
            className="p-3 bg-surface border border-border rounded-lg hover:bg-surface-elevated transition-colors"
            aria-label={t('recenterGraph')}
            title={t('recenterGraph')}
          >
            <svg
              className="w-5 h-5 text-primary dark:text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <circle cx="12" cy="12" r="3" strokeWidth="2" fill="currentColor" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4M2 12h4m12 0h4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
