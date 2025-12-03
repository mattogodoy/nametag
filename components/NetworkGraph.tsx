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

interface NetworkGraphProps {
  personId: string;
  refreshKey?: number;
}

export default function NetworkGraph({ personId, refreshKey }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();
  const previousNodeIdsRef = useRef<Set<string> | null>(null);
  const isInitialRenderRef = useRef(true);

  useEffect(() => {
    if (!svgRef.current) return;

    // Fetch graph data
    fetch(`/api/people/${personId}/graph`)
      .then((res) => res.json())
      .then((data: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
        // Identify new nodes
        const currentNodeIds = new Set(data.nodes.map(n => n.id));
        const newNodeIds = new Set<string>();

        // Only check for new nodes if not initial render and we have previous data
        if (!isInitialRenderRef.current && previousNodeIdsRef.current) {
          data.nodes.forEach(node => {
            if (!previousNodeIdsRef.current!.has(node.id)) {
              newNodeIds.add(node.id);
            }
          });
        }

        // Render graph with new node information
        renderGraph(data.nodes, data.edges, newNodeIds);

        // Update refs for next render
        previousNodeIdsRef.current = currentNodeIds;
        isInitialRenderRef.current = false;
      })
      .catch((error) => {
        console.error('Failed to load graph data:', error);
      });
  }, [personId, refreshKey]);

  const renderGraph = (nodes: GraphNode[], edges: GraphEdge[], newNodeIds: Set<string>) => {
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
          .attr('refX', 18)
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
          .distance(100)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(25));

    // Create edges with arrows
    const link = g
      .append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', (d: any) => d.color || '#999')
      .attr('stroke-opacity', (d: any) => {
        // Fade in only edges connected to new nodes
        const targetNode = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
        return newNodeIds.has(targetNode) ? 0 : 0.15;
      })
      .attr('stroke-width', 2)
      .attr('marker-end', (d: any) => `url(#arrow-${(d.color || '#999').replace('#', '')}-normal)`);

    // Animate edges connected to new nodes
    link
      .filter((d: any) => {
        const targetNode = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
        return newNodeIds.has(targetNode);
      })
      .transition()
      .duration(400)
      .delay(100)
      .attr('stroke-opacity', 0.15);

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
      .text((d) => d.type.toLowerCase())
      .style('opacity', 0);

    // Don't show labels for new nodes either (keep them hidden)

    // Create nodes
    const node = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended)
      )
      .on('click', (_event, d) => {
        router.push(`/people/${d.id}`);
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
          .style('opacity', (edge: any) => {
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
          .style('opacity', 0);
      });

    // Add circles to nodes
    const circles = node
      .append('circle')
      .attr('r', (d) => (d.isCenter ? 9 : 7))
      .attr('fill', (d) => (d.isCenter ? '#3B82F6' : '#6B7280'))
      .attr('stroke', (d) => (d.isCenter ? '#1E40AF' : '#fff'))
      .attr('stroke-width', (d) => (d.isCenter ? 3 : 2));

    // Animate only new nodes with bounce effect
    circles
      .filter((d) => newNodeIds.has(d.id))
      .style('transform', 'scale(0)')
      .style('transform-origin', 'center')
      .transition()
      .duration(600)
      .ease(d3.easeElasticOut.amplitude(1).period(0.4))
      .style('transform', 'scale(1)');

    // Add labels to nodes
    const labels = node
      .append('text')
      .text((d) => d.label)
      .attr('x', 0)
      .attr('y', 22)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('font-weight', (d) => (d.isCenter ? 'bold' : 'normal'))
      .attr('fill', '#9CA3AF')
      .style('pointer-events', 'none')
      .style('opacity', (d) => newNodeIds.has(d.id) ? 0 : 1);

    // Animate only new node labels with fade-in
    labels
      .filter((d) => newNodeIds.has(d.id))
      .transition()
      .duration(400)
      .delay(200)
      .style('opacity', 1);

    // Update positions on each tick
    simulation.on('tick', () => {
      // Use selection.each to avoid interrupting transitions
      link.each(function (d: any) {
        d3.select(this)
          .attr('x1', d.source.x)
          .attr('y1', d.source.y)
          .attr('x2', d.target.x)
          .attr('y2', d.target.y);
      });

      edgeLabels.each(function (d: any) {
        d3.select(this)
          .attr('x', (d.source.x + d.target.x) / 2)
          .attr('y', (d.source.y + d.target.y) / 2);
      });

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
