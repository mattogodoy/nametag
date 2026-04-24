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
import type {
  SimulationNode, SimulationEdge, PersonSimNode,
} from './graph/simulation-types';

// Props interface — unchanged from pre-rewrite file
interface Group { id: string; name: string; color: string | null; }
type IncludeMode = 'or' | 'and';
type GroupFilterItem = { id: string; label: string; color: string | null; isNegative: boolean; };

interface UnifiedNetworkGraphProps {
  apiEndpoint?: string;
  groups?: Group[];
  centerNodeId?: string;
  centerNodeNonClickable?: boolean;
  linkDistance?: number;
  chargeStrength?: number;
  animateNewNodes?: boolean;
  refreshKey?: number;
  enableGroupClustering?: boolean;
  clusterStrength?: number;
}

export default function UnifiedNetworkGraph({
  apiEndpoint,
  groups,
  centerNodeNonClickable = false,
  linkDistance = 120,
  chargeStrength = -400,
  refreshKey,
  enableGroupClustering = true,
  clusterStrength = 0.3,
}: UnifiedNetworkGraphProps) {
  const t = useTranslations('dashboard.graph');
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

  // Filter state
  const [selectedGroupFilters, setSelectedGroupFilters] = useState<GroupFilterItem[]>([]);
  const [includeMode, setIncludeMode] = useState<IncludeMode>('or');
  const [isMobile, setIsMobile] = useState(false);
  const [clusteringEnabled, setClusteringEnabled] = useState(enableGroupClustering);
  const capitalizeType = useLocale().startsWith('de');

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
      },
      nodesRef.current,
      edgesRef.current,
    );
  }, [isMobile, requestPaint]);

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
    const mobileLinkDistance = isMobile ? 80 : linkDistance;
    const mobileChargeStrength = isMobile ? -250 : chargeStrength;
    const collisionRadius = clusteringEnabled ? (isMobile ? 40 : 50) : (isMobile ? 25 : 30);

    const sim = forceSimulation<SimulationNode>(nodes)
      .velocityDecay(0.6)
      .force('link', forceLink<SimulationNode, SimulationEdge>(edges)
        .id((d) => d.id)
        .distance(mobileLinkDistance))
      .force('charge', forceManyBody().strength(
        clusteringEnabled ? mobileChargeStrength * 1.5 : mobileChargeStrength,
      ))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collision', forceCollide().radius(collisionRadius));

    if (clusteringEnabled) {
      const uniqueGroupIds = Array.from(new Set(nodes.flatMap((n) => n.kind === 'person' ? n.groups : []))).filter(Boolean);
      const clusterRadius = Math.min(width, height) * 0.35;
      const clusterCenters = new Map<string, { x: number; y: number }>();
      uniqueGroupIds.forEach((groupId, index) => {
        const angle = (2 * Math.PI * index) / uniqueGroupIds.length - Math.PI / 2;
        clusterCenters.set(groupId, {
          x: width / 2 + clusterRadius * Math.cos(angle),
          y: height / 2 + clusterRadius * Math.sin(angle),
        });
      });
      const target = (d: SimulationNode) => {
        if (d.kind !== 'person') return null;
        if (d.isCenter || d.groups.length === 0) return null;
        return clusterCenters.get(d.groups[0]) ?? null;
      };
      sim
        .force('clusterX', forceX<SimulationNode>((d) => target(d)?.x ?? width / 2)
          .strength((d) => (target(d) ? clusterStrength : 0)))
        .force('clusterY', forceY<SimulationNode>((d) => target(d)?.y ?? height / 2)
          .strength((d) => (target(d) ? clusterStrength : 0)));
    }

    sim.on('tick', () => {
      quadtreeRef.current = buildQuadtree(nodes);
      requestPaint();
    });

    return sim;
  }, [isMobile, linkDistance, chargeStrength, clusteringEnabled, clusterStrength, requestPaint]);

  // Step 3: Data-fetch effect
  useEffect(() => {
    if (!canvasRef.current || !apiEndpoint) return;

    let cancelled = false;

    const fetchData = async () => {
      const url = new URL(apiEndpoint, window.location.origin);
      url.searchParams.set('groupMatchOperator', includeMode);
      if (includeGroupIds.length > 0) url.searchParams.set('includeGroupIds', includeGroupIds.join(','));
      if (excludeGroupIds.length > 0) url.searchParams.set('excludeGroupIds', excludeGroupIds.join(','));

      const response = await fetch(url.toString());
      const data = await response.json() as { nodes: Omit<PersonSimNode, 'kind'>[]; edges: SimulationEdge[] };

      if (cancelled) return;

      const incomingNodes: SimulationNode[] = data.nodes.map((n) => ({ ...n, kind: 'person' }));
      const incomingEdges: SimulationEdge[] = data.edges;

      const { nodes, edges } = diffSimulationData(
        nodesRef.current,
        incomingNodes,
        edgesRef.current,
        incomingEdges,
      );
      nodesRef.current = nodes;
      edgesRef.current = edges;

      simRef.current?.stop();
      const sim = buildSimulation(nodes, edges);
      if (sim) {
        sim.alpha(0.3).restart();
        simRef.current = sim;
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [apiEndpoint, refreshKey, includeMode, includeGroupIds, excludeGroupIds, clusteringEnabled, buildSimulation]);

  // Step 4: Zoom, click, hover, and drag handlers
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

    const onClick = (event: MouseEvent) => {
      const node = nodeAt(event.clientX, event.clientY);
      if (!node) return;
      if (node.kind !== 'person') return;
      if (centerNodeNonClickable && node.isCenter) return;
      if (node.id.startsWith('user-')) router.push('/dashboard');
      else router.push(`/people/${node.id}`);
    };

    const drag_ = drag<HTMLCanvasElement, unknown>()
      .container(canvas)
      .subject((event) => {
        const node = nodeAt(event.sourceEvent.clientX, event.sourceEvent.clientY);
        return node ?? null;
      })
      .on('start', (event) => {
        const d = event.subject as SimulationNode | null;
        if (!d) return;
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
      });

    select(canvas).call(drag_);

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);

    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
      select(canvas).on('.zoom', null);
      select(canvas).on('.drag', null);
    };
  }, [centerNodeNonClickable, isMobile, requestPaint, router]);

  // capitalizeType is reserved for future label rendering use.
  void capitalizeType;

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
          <button
            onClick={() => setClusteringEnabled(!clusteringEnabled)}
            className={`p-3 border rounded-lg transition-colors ${
              clusteringEnabled
                ? 'bg-primary/20 border-primary/40 dark:bg-primary dark:border-primary'
                : 'bg-surface border-border hover:bg-surface-elevated'
            }`}
            aria-label={t('clusterByGroup')}
            title={t('clusterByGroup')}
          >
            <svg
              className="w-5 h-5 text-primary dark:text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </button>
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
