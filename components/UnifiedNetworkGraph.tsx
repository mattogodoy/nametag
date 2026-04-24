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

  // --- rendering stubs; Tasks 8–10 fill these in ---
  const requestPaint = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  // The following are referenced here so TypeScript/ESLint does not flag them
  // as unused while Task 8 wires them up. Do not remove.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const _unusedRefs = {
    simRef, nodesRef, edgesRef, quadtreeRef, hoveredNodeIdRef, rafRef,
    zoomBehaviorRef, transformRef,
  };
  const _unusedProps = {
    apiEndpoint, centerNodeNonClickable, linkDistance, chargeStrength, refreshKey,
    clusterStrength, capitalizeType, router, isMobile, clusteringEnabled,
    includeGroupIds, excludeGroupIds, includeMode, requestPaint,
  };
  const _unusedImports = {
    paintFrame, getLODTier, getCachedPhoto, loadPhoto, buildQuadtree,
    findNodeAtPoint, diffSimulationData,
    forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
    forceX, forceY, drag,
  };
  /* eslint-enable @typescript-eslint/no-unused-vars */
  // PersonSimNode, SimulationNode, SimulationEdge are type-only imports —
  // TypeScript does not error on unused type imports.

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
