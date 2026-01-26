'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import PillSelector from './PillSelector';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  groups: string[];
  colors: string[];
  isCenter: boolean;
}

interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  color: string;
}

interface Group {
  id: string;
  name: string;
  color: string | null;
}

interface UnifiedNetworkGraphProps {
  // Data source: either fetch from API or use provided data
  apiEndpoint?: string;

  // For dashboard mode with groups filter
  groups?: Group[];

  // For controlling center node behavior
  centerNodeId?: string; // ID of the center node (e.g., user or person)
  centerNodeNonClickable?: boolean; // If true, center node won't navigate

  // Force simulation parameters
  linkDistance?: number;
  chargeStrength?: number;

  // Animation for new nodes
  animateNewNodes?: boolean;

  // Refresh trigger
  refreshKey?: number;

  // Clustering by group
  enableGroupClustering?: boolean;
  clusterStrength?: number; // 0 to 1, how strongly nodes are pulled to their cluster
}

export default function UnifiedNetworkGraph({
  apiEndpoint,
  groups,
  centerNodeNonClickable = false,
  linkDistance = 120,
  chargeStrength = -400,
  animateNewNodes = false,
  refreshKey,
  enableGroupClustering = true,
  clusterStrength = 0.3,
}: UnifiedNetworkGraphProps) {
  const t = useTranslations('dashboard.graph');
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();
  const previousNodeIdsRef = useRef<Set<string> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [clusteringEnabled, setClusteringEnabled] = useState(enableGroupClustering);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Function to re-center the graph view
  const recenterGraph = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;

    const svg = d3.select(svgRef.current);

    // Reset to identity transform (no zoom, no pan)
    svg
      .transition()
      .duration(750)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);

    // Clear the stored transform
    zoomTransformRef.current = null;
  }, []);

  const renderGraph = useCallback((data: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
    if (!svgRef.current) return;

    // Clear previous graph
    d3.select(svgRef.current).selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Data is already filtered by the API based on selectedGroupId
    const filteredNodes = data.nodes;
    const filteredEdges = data.edges;

    const nodes = filteredNodes;
    const edges = filteredEdges;

    // Mobile-specific parameters
    const nodeRadius = isMobile ? { center: 10, normal: 7 } : { center: 12, normal: 8 };
    const fontSize = isMobile ? { center: 12, normal: 10, edge: 9 } : { center: 14, normal: 12, edge: 10 };
    const mobileLinkDistance = isMobile ? 80 : linkDistance;
    const mobileChargeStrength = isMobile ? -250 : chargeStrength;

    // Track new nodes for animation
    const currentNodeIds = new Set(nodes.map((n) => n.id));
    const newNodeIds = animateNewNodes && previousNodeIdsRef.current
      ? new Set([...currentNodeIds].filter((id) => !previousNodeIdsRef.current!.has(id)))
      : new Set<string>();
    previousNodeIdsRef.current = currentNodeIds;

    const svg = d3.select(svgRef.current);

    // Main group for zooming/panning
    const g = svg.append('g');

    // Define arrow markers for directed edges (one for each unique color)
    const defs = svg.append('defs');
    const uniqueColors = Array.from(new Set(edges.map((e) => e.color || '#999')));
    uniqueColors.forEach((color) => {
      defs.append('marker')
        .attr('id', `arrow-${color.replace('#', '')}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 18)
        .attr('refY', 0)
        .attr('markerWidth', 5)
        .attr('markerHeight', 5)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color)
        .attr('fill-opacity', 0.8)
    });

    // Calculate cluster positions for group clustering
    const clusterCenters: Map<string, { x: number; y: number }> = new Map();
    if (clusteringEnabled) {
      // Get unique group IDs from nodes
      const uniqueGroupIds = Array.from(
        new Set(nodes.flatMap((n) => n.groups))
      ).filter(Boolean);

      // Arrange clusters in a circle around the center
      const clusterRadius = Math.min(width, height) * 0.35;
      uniqueGroupIds.forEach((groupId, index) => {
        const angle = (2 * Math.PI * index) / uniqueGroupIds.length - Math.PI / 2;
        clusterCenters.set(groupId, {
          x: width / 2 + clusterRadius * Math.cos(angle),
          y: height / 2 + clusterRadius * Math.sin(angle),
        });
      });
    }

    // Helper to get target position for a node based on its groups
    const getClusterTarget = (node: GraphNode): { x: number; y: number } | null => {
      if (!clusteringEnabled || node.isCenter || node.groups.length === 0) {
        return null;
      }
      // Use the first group as the primary cluster
      const primaryGroup = node.groups[0];
      return clusterCenters.get(primaryGroup) || null;
    };

    const getNodeId = (n: string | GraphNode): string => (typeof n === 'string' ? n : n.id);

    type SimEdge = Omit<GraphEdge, 'source' | 'target'> & { source: GraphNode; target: GraphNode };
    const simEdges = edges as unknown as SimEdge[];

    // Increase collision radius when clustering to spread nodes apart more
    const collisionRadius = clusteringEnabled
      ? (isMobile ? 40 : 50)
      : (isMobile ? 25 : 30);

    // Create force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3.forceLink<GraphNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance(mobileLinkDistance)
      )
      .force('charge', d3.forceManyBody().strength(clusteringEnabled ? mobileChargeStrength * 1.5 : mobileChargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(collisionRadius));

    // Add clustering forces if enabled
    if (clusteringEnabled) {
      simulation
        .force(
          'clusterX',
          d3.forceX<GraphNode>((d) => {
            const target = getClusterTarget(d);
            return target ? target.x : width / 2;
          }).strength((d) => (getClusterTarget(d) ? clusterStrength : 0))
        )
        .force(
          'clusterY',
          d3.forceY<GraphNode>((d) => {
            const target = getClusterTarget(d);
            return target ? target.y : height / 2;
          }).strength((d) => (getClusterTarget(d) ? clusterStrength : 0))
        );
    }

    // Create edges
    const link = g
      .append('g')
      .selectAll('line')
      .data(simEdges)
      .enter()
      .append('line')
      .attr('stroke', (d) => d.color || '#999')
      .attr('stroke-opacity', (d) => {
        if (animateNewNodes) {
          // Fade in only edges connected to new nodes
          const targetNode = getNodeId(d.target);
          return newNodeIds.has(targetNode) ? 0 : 0.15;
        }
        return 0.15;
      })
      .attr('stroke-width', 2)

    // Animate edges connected to new nodes
    if (animateNewNodes) {
      link
        .filter((d) => {
          const targetNode = getNodeId(d.target);
          return newNodeIds.has(targetNode);
        })
        .transition()
        .duration(400)
        .delay(100)
        .attr('stroke-opacity', 0.15);
    }

    // Create edge labels (hidden by default)
    const edgeLabels = g
      .append('g')
      .selectAll('text')
      .data(simEdges)
      .enter()
      .append('text')
      .attr('font-size', fontSize.edge)
      .attr('fill', (d) => d.color || '#666')
      .attr('text-anchor', 'middle')
      .attr('opacity', 0)
      .text((d) => d.type.toLowerCase());

    // Create nodes
    const node = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', (d) => {
        if (centerNodeNonClickable && d.isCenter) return 'default';
        return 'pointer';
      })
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended)
      )
      .on('click', (_event, d) => {
        // Don't navigate if it's the center node and centerNodeNonClickable is true
        if (centerNodeNonClickable && d.isCenter) return;

        // Check if it's the user node (starts with "user-")
        if (d.id.startsWith('user-')) {
          router.push('/dashboard');
        } else {
          router.push(`/people/${d.id}`);
        }
      })
      .on('mouseenter', function(_event, d) {
        // Highlight connected edges and show their arrow markers
        link
          .transition()
          .duration(200)
          .attr('stroke-opacity', (edge) => {
            const sourceId = getNodeId(edge.source);
            return sourceId === d.id ? 0.8 : 0.05;
          })
          .attr('marker-end', (edge) => {
            const sourceId = getNodeId(edge.source);
            return sourceId === d.id ? `url(#arrow-${(edge.color || '#999').replace('#', '')})`: null;
          });

        // Show labels for connected edges
        edgeLabels
          .transition()
          .duration(200)
          .attr('opacity', (edge) => {
            const sourceId = getNodeId(edge.source);
            return sourceId === d.id ? 1 : 0;
          });
      })
      .on('mouseleave', function() {
        // Reset edge opacity and arrow markers
        link
          .transition()
          .duration(200)
          .attr('stroke-opacity', 0.15)
          .attr('marker-end', null);

        // Hide all labels
        edgeLabels
          .transition()
          .duration(200)
          .attr('opacity', 0);
      });

    // Add circles to nodes
    const isDarkTheme = document.documentElement.classList.contains('dark');
    const circles = node
      .append('circle')
      .attr('r', (d) => (d.isCenter ? nodeRadius.center : nodeRadius.normal))
      .attr('fill', (d) => {
        if (d.isCenter) return '#3B82F6'; // Blue for center
        if (d.colors.length > 0) return d.colors[0];
        return '#9CA3AF';
      })
      .attr('stroke', isDarkTheme ? '#fff' : '#1f2937') // White in dark theme, dark grey in light theme
      .attr('stroke-width', 2);

    // Animate new nodes
    if (animateNewNodes) {
      circles
        .filter((d) => newNodeIds.has(d.id))
        .attr('r', 0)
        .transition()
        .duration(300)
        .attr('r', (d) => (d.isCenter ? nodeRadius.center : nodeRadius.normal));
    }

    // Add labels to nodes
    const labels = node
      .append('text')
      .text((d) => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => (d.isCenter ? (isMobile ? 22 : 25) : (isMobile ? 18 : 20)))
      .attr('font-size', (d) => (d.isCenter ? fontSize.center : fontSize.normal))
      .attr('font-weight', (d) => (d.isCenter ? 'bold' : 'normal'))
      .attr('fill', 'currentColor')
      .style('pointer-events', 'none');

    // Animate new node labels
    if (animateNewNodes) {
      labels
        .filter((d) => newNodeIds.has(d.id))
        .style('opacity', 0)
        .transition()
        .duration(300)
        .style('opacity', 1);
    }

    // Add zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        // Save the current transform for restoration on re-render
        zoomTransformRef.current = event.transform;
      });

    // Store zoom behavior for re-centering
    zoomBehaviorRef.current = zoom;

    svg.call(zoom);

    // Restore previous zoom transform if it exists
    if (zoomTransformRef.current) {
      svg.call(zoom.transform, zoomTransformRef.current);
    }

    // Update positions on each tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x ?? 0)
        .attr('y1', (d) => d.source.y ?? 0)
        .attr('x2', (d) => d.target.x ?? 0)
        .attr('y2', (d) => d.target.y ?? 0);

      // Position edge labels at the center of edges
      edgeLabels
        .attr('x', (d) => ((d.source.x ?? 0) + (d.target.x ?? 0)) / 2)
        .attr('y', (d) => ((d.source.y ?? 0) + (d.target.y ?? 0)) / 2);

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Drag functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  }, [
    animateNewNodes,
    centerNodeNonClickable,
    chargeStrength,
    clusterStrength,
    clusteringEnabled,
    isMobile,
    linkDistance,
    router,
  ]);

  useEffect(() => {
    if (!svgRef.current || !apiEndpoint) return;

    const fetchData = async () => {
      // Build URL with query parameters
      const url = new URL(apiEndpoint, window.location.origin);
      // Add all selected group IDs as query parameters
      if (selectedGroupIds.length > 0) {
        selectedGroupIds.forEach((groupId) => {
          url.searchParams.append('groupIds', groupId);
        });
      }

      const response = await fetch(url.toString());
      const data = await response.json();
      renderGraph(data);
    };

    fetchData();
  }, [apiEndpoint, refreshKey, selectedGroupIds, isMobile, clusteringEnabled, renderGraph]);

  return (
    <div className="w-full h-full">
      {groups && (
        <div className="mb-4">
          <PillSelector
            label={t('filterByGroups')}
            selectedItems={groups
              .filter((g) => selectedGroupIds.includes(g.id))
              .map((g) => ({
                id: g.id,
                label: g.name,
                color: g.color,
              }))}
            availableItems={groups.map((g) => ({
              id: g.id,
              label: g.name,
              color: g.color,
            }))}
            onAdd={(item) => setSelectedGroupIds([...selectedGroupIds, item.id])}
            onRemove={(itemId) =>
              setSelectedGroupIds(selectedGroupIds.filter((id) => id !== itemId))
            }
            onClearAll={() => setSelectedGroupIds([])}
            placeholder={t('filterPlaceholder')}
            emptyMessage={t('noGroupsFound')}
            showAllOnFocus={true}
            renderPill={(item, onRemove) => (
              <div
                key={item.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 border border-primary/40 rounded-full text-sm font-medium shadow-sm"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/50"
                  style={{ backgroundColor: item.color || '#7bf080' }}
                />
                <span className="text-foreground">{item.label}</span>
                <button
                  type="button"
                  onClick={onRemove}
                  className="hover:bg-primary/30 rounded-full p-0.5 transition-colors text-primary"
                  aria-label={`Remove ${item.label}`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}
          />
        </div>
      )}
      <div className="relative">
        <svg
          ref={svgRef}
          className="w-full h-[400px] sm:h-[500px] lg:h-[600px] bg-surface rounded-lg border-2 border-border"
        />
        <div className="absolute bottom-4 right-4 flex gap-2">
          <button
            onClick={() => setClusteringEnabled(!clusteringEnabled)}
            className={`p-3 border-2 rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all ${
              clusteringEnabled
                ? 'bg-primary/30 border-primary/30 shadow-primary/20 dark:bg-primary dark:border-primary dark:shadow-primary/50'
                : 'bg-surface border-primary/30 shadow-border/20 hover:bg-surface-elevated dark:bg-surface dark:border-border dark:hover:bg-surface-elevated'
            }`}
            aria-label={t('clusterByGroup')}
            title={t('clusterByGroup')}
          >
            <svg
              className="w-5 h-5 text-primary drop-shadow-lg dark:text-white"
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
            className="p-3 bg-surface border-2 border-primary/30 shadow-lg shadow-border/20 rounded-lg hover:scale-105 active:scale-95 transition-all dark:bg-surface dark:border-border dark:hover:bg-surface-elevated dark:hover:border-secondary/50"
            aria-label={t('recenterGraph')}
            title={t('recenterGraph')}
          >
            <svg
              className="w-5 h-5 text-primary drop-shadow-lg dark:text-white"
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
