'use client';

import { useEffect, useRef } from 'react';
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

interface DashboardNetworkGraphProps {
  refreshKey?: number;
}

export default function DashboardNetworkGraph({ refreshKey }: DashboardNetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!svgRef.current) return;

    // Fetch graph data
    fetch('/api/dashboard/graph')
      .then((res) => res.json())
      .then((data: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
        renderGraph(data.nodes, data.edges);
      })
      .catch((error) => {
        console.error('Failed to load graph data:', error);
      });
  }, [refreshKey]);

  const renderGraph = (nodes: GraphNode[], edges: GraphEdge[]) => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous graph

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Main group for zooming/panning
    const g = svg.append('g');

    // Define arrow markers for directed edges (one for each unique color)
    const defs = svg.append('defs');
    const uniqueColors = Array.from(new Set(edges.map((e: any) => e.color || '#999')));

    uniqueColors.forEach((color) => {
      defs.append('marker')
        .attr('id', `arrow-${color.replace('#', '')}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 4)
        .attr('markerHeight', 4)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color);
    });

    // Create force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3.forceLink(edges)
          .id((d: any) => d.id)
          .distance(120)
      )
      .force('charge', d3.forceManyBody().strength(-400))
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
      .attr('stroke-opacity', 0.15)
      .attr('stroke-width', 2)
      .attr('marker-end', (d: any) => `url(#arrow-${(d.color || '#999').replace('#', '')})`);

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
      .style('cursor', (d) => d.isCenter ? 'default' : 'pointer')
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended)
      )
      .on('click', (_event, d) => {
        // Don't navigate if clicking the center user node
        if (!d.isCenter) {
          router.push(`/people/${d.id}`);
        }
      })
      .on('mouseenter', function(_event, d) {
        // Highlight connected edges
        link
          .transition()
          .duration(200)
          .attr('stroke-opacity', (edge: any) => {
            const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
            const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
            return (sourceId === d.id || targetId === d.id) ? 0.8 : 0.05;
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
        // Reset edge opacity
        link
          .transition()
          .duration(200)
          .attr('stroke-opacity', 0.15);

        // Hide all labels
        edgeLabels
          .transition()
          .duration(200)
          .attr('opacity', 0);
      });

    // Add circles to nodes
    node
      .append('circle')
      .attr('r', (d) => (d.isCenter ? 9 : 7))
      .attr('fill', (d) => (d.isCenter ? '#3B82F6' : '#6B7280'))
      .attr('stroke', (d) => (d.isCenter ? '#1E40AF' : '#fff'))
      .attr('stroke-width', (d) => (d.isCenter ? 3 : 2));

    // Add labels to nodes
    node
      .append('text')
      .text((d) => d.label)
      .attr('x', 0)
      .attr('y', 22)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('font-weight', (d) => (d.isCenter ? 'bold' : 'normal'))
      .attr('fill', '#9CA3AF')
      .style('pointer-events', 'none');

    // Update positions on each tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      // Position labels at the center of the edge
      edgeLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  };

  return (
    <div className="w-full h-96 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
