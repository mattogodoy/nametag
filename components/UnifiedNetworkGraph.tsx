'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useRouter } from 'next/navigation';

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
}

export default function UnifiedNetworkGraph({
  apiEndpoint,
  groups,
  centerNodeId,
  centerNodeNonClickable = false,
  linkDistance = 120,
  chargeStrength = -400,
  animateNewNodes = false,
  refreshKey,
}: UnifiedNetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();
  const previousNodeIdsRef = useRef<Set<string> | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || !apiEndpoint) return;

    const fetchData = async () => {
      // Build URL with query parameters
      const url = new URL(apiEndpoint, window.location.origin);
      if (selectedGroupId) {
        url.searchParams.set('groupId', selectedGroupId);
      }

      const response = await fetch(url.toString());
      const data = await response.json();
      renderGraph(data);
    };

    fetchData();
  }, [apiEndpoint, refreshKey, selectedGroupId]);

  const renderGraph = (data: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
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

    // Track new nodes for animation
    const currentNodeIds = new Set(nodes.map((n) => n.id));
    const newNodeIds = animateNewNodes && previousNodeIdsRef.current
      ? new Set([...currentNodeIds].filter((id) => !previousNodeIdsRef.current!.has(id)))
      : new Set<string>();
    previousNodeIdsRef.current = currentNodeIds;

    const svg = d3.select(svgRef.current);

    // Main group for zooming/panning
    const g = svg.append('g');

    // Define arrow markers for directed edges (one for each unique color and opacity)
    const defs = svg.append('defs');
    const uniqueColors = Array.from(new Set(edges.map((e: any) => e.color || '#999')));
    const opacityLevels = [
      { value: 0.05, id: 'dim' },
      { value: 0.15, id: 'normal' },
      { value: 0.8, id: 'highlight' }
    ];

    uniqueColors.forEach((color) => {
      opacityLevels.forEach((level) => {
        defs.append('marker')
          .attr('id', `arrow-${color.replace('#', '')}-${level.id}`)
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', 20)
          .attr('refY', 0)
          .attr('markerWidth', 4)
          .attr('markerHeight', 4)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M0,-5L10,0L0,5')
          .attr('fill', color)
          .attr('fill-opacity', level.value);
      });
    });

    // Create force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3.forceLink(edges)
          .id((d: any) => d.id)
          .distance(linkDistance)
      )
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Create edges with arrows
    const link = g
      .append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', (d: any) => d.color || '#999')
      .attr('stroke-opacity', (d: any) => {
        if (animateNewNodes) {
          // Fade in only edges connected to new nodes
          const targetNode = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
          return newNodeIds.has(targetNode) ? 0 : 0.15;
        }
        return 0.15;
      })
      .attr('stroke-width', 2)
      .attr('marker-end', (d: any) => `url(#arrow-${(d.color || '#999').replace('#', '')}-normal)`);

    // Animate edges connected to new nodes
    if (animateNewNodes) {
      link
        .filter((d: any) => {
          const targetNode = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
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
      .data(edges)
      .enter()
      .append('text')
      .attr('font-size', 10)
      .attr('fill', (d: any) => d.color || '#666')
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
        // Highlight connected edges and update their arrow markers
        link
          .transition()
          .duration(200)
          .attr('stroke-opacity', (edge: any) => {
            const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
            const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
            return (sourceId === d.id || targetId === d.id) ? 0.8 : 0.05;
          })
          .attr('marker-end', (edge: any) => {
            const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
            const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
            const opacityId = (sourceId === d.id || targetId === d.id) ? 'highlight' : 'dim';
            return `url(#arrow-${(edge.color || '#999').replace('#', '')}-${opacityId})`;
          });

        // Show labels for connected edges
        edgeLabels
          .transition()
          .duration(200)
          .attr('opacity', (edge: any) => {
            const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
            const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
            return (sourceId === d.id || targetId === d.id) ? 1 : 0;
          });
      })
      .on('mouseleave', function() {
        // Reset edge opacity and arrow markers
        link
          .transition()
          .duration(200)
          .attr('stroke-opacity', 0.15)
          .attr('marker-end', (d: any) => `url(#arrow-${(d.color || '#999').replace('#', '')}-normal)`);

        // Hide all labels
        edgeLabels
          .transition()
          .duration(200)
          .attr('opacity', 0);
      });

    // Add circles to nodes
    const circles = node
      .append('circle')
      .attr('r', (d) => (d.isCenter ? 12 : 8))
      .attr('fill', (d) => {
        if (d.isCenter) return '#3B82F6'; // Blue for center
        if (d.colors.length > 0) return d.colors[0];
        return '#9CA3AF';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Animate new nodes
    if (animateNewNodes) {
      circles
        .filter((d) => newNodeIds.has(d.id))
        .attr('r', 0)
        .transition()
        .duration(300)
        .attr('r', (d) => (d.isCenter ? 12 : 8));
    }

    // Add labels to nodes
    const labels = node
      .append('text')
      .text((d) => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => (d.isCenter ? 25 : 20))
      .attr('font-size', (d) => (d.isCenter ? 14 : 12))
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
      });

    svg.call(zoom as any);

    // Update positions on each tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      // Position edge labels at the center of edges
      edgeLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  };

  return (
    <div className="w-full h-full">
      {groups && (
        <div className="mb-4">
          <label htmlFor="group-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by Group
          </label>
          <select
            id="group-filter"
            value={selectedGroupId || ''}
            onChange={(e) => setSelectedGroupId(e.target.value || null)}
            className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white"
          >
            <option value="">All groups</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <svg
        ref={svgRef}
        className="w-full h-[600px] bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
      />
    </div>
  );
}
