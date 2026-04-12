'use client';

/**
 * GraphDisplay — force-directed SVG graph View display type.
 *
 * Any View with layout: 'graph' renders through this component.
 * Each record from the View's data source becomes a node.
 * Relations between nodes are derived from data fields (e.g. content JSON
 * containing references to other nodes, or explicit relation fields).
 *
 * The force simulation runs client-side using a simple spring/repulsion model.
 * No external dependencies — pure React + SVG.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { FieldConfig } from './TableDisplay';
import { getTypeVisualizationColorToken } from '../../../lib/visualization-colors';

interface NodePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
  label: string;
  type: string;
  data: Record<string, unknown>;
}

interface Edge {
  source: number;
  target: number;
  /** True when this edge originates from a sync node's pattern */
  isSync?: boolean;
}

interface GraphDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
}

/** Extract edges from data — nodes that reference each other by name/id */
function buildEdges(nodes: NodePosition[]): Edge[] {
  const edges: Edge[] = [];
  const labelIndex = new Map<string, number>();
  nodes.forEach((n, i) => {
    labelIndex.set(n.label, i);
    // Also index without prefix
    const short = n.label.replace(/^(concept|schema|sync|suite|view|theme):/, '');
    if (short !== n.label) labelIndex.set(short, i);
  });

  // Look for references in content field or explicit relation fields
  nodes.forEach((node, sourceIdx) => {
    const content = node.data.content as string | undefined;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        // Check for pattern fields (syncs referencing concepts)
        const pattern = parsed.pattern as string | undefined;
        if (pattern) {
          const isSync = node.type === 'Sync';
          // Pattern like "ContentStorage/save -> Cache/invalidateByTags"
          const parts = pattern.split(/\s*->\s*/);
          const resolvedConcepts: number[] = [];
          for (const part of parts) {
            const conceptName = part.split('/')[0]?.trim();
            if (conceptName) {
              // Try to find matching concept node
              const targetIdx = labelIndex.get(`concept:${conceptName}`);
              if (targetIdx !== undefined && targetIdx !== sourceIdx) {
                edges.push({ source: sourceIdx, target: targetIdx, isSync });
                resolvedConcepts.push(targetIdx);
              }
            }
          }
          // For syncs, also create a direct concept-to-concept edge
          // so the wiring is visible even when the sync node is filtered out
          if (isSync && resolvedConcepts.length >= 2) {
            for (let i = 0; i < resolvedConcepts.length - 1; i++) {
              edges.push({
                source: resolvedConcepts[i],
                target: resolvedConcepts[i + 1],
                isSync: true,
              });
            }
          }
        }
        // Check for suite field linking to suites
        const suite = parsed.suite as string | undefined;
        if (suite) {
          const targetIdx = labelIndex.get(`suite:${suite}`);
          if (targetIdx !== undefined && targetIdx !== sourceIdx) {
            edges.push({ source: sourceIdx, target: targetIdx });
          }
        }
      } catch { /* not JSON, skip */ }
    }

    // Same-type clustering: connect nodes of the same type in a ring
    // (This creates implicit grouping in the force layout)
  });

  return edges;
}

/** Simple force-directed layout simulation */
function simulate(
  nodes: NodePosition[],
  edges: Edge[],
  width: number,
  height: number,
  iterations: number = 120,
): NodePosition[] {
  const result = nodes.map((n) => ({ ...n }));

  // Initialize positions in a circle
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;
  result.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / result.length;
    node.x = cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 20;
    node.y = cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 20;
    node.vx = 0;
    node.vy = 0;
  });

  const repulsionStrength = 3000;
  const attractionStrength = 0.005;
  const edgeLength = 120;
  const damping = 0.85;
  const centerGravity = 0.01;

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all pairs
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const dx = result[i].x - result[j].x;
        const dy = result[i].y - result[j].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = repulsionStrength / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        result[i].vx += fx;
        result[i].vy += fy;
        result[j].vx -= fx;
        result[j].vy -= fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const s = result[edge.source];
      const t = result[edge.target];
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - edgeLength) * attractionStrength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx += fx;
      s.vy += fy;
      t.vx -= fx;
      t.vy -= fy;
    }

    // Center gravity
    for (const node of result) {
      node.vx += (cx - node.x) * centerGravity;
      node.vy += (cy - node.y) * centerGravity;
    }

    // Apply velocities with damping
    for (const node of result) {
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;
      // Clamp to bounds
      node.x = Math.max(60, Math.min(width - 60, node.x));
      node.y = Math.max(30, Math.min(height - 30, node.y));
    }
  }

  return result;
}

export const GraphDisplay: React.FC<GraphDisplayProps> = ({ data, fields, onRowClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 500 });

  const labelField = fields[0]?.key ?? Object.keys(data[0] ?? {})[0] ?? 'id';

  // Build graph — use primary schema (first in array) for coloring
  // Memoize layout so hover state changes don't re-run the simulation
  const { nodes, edges } = useMemo(() => {
    const rawNodes: NodePosition[] = data.map((item) => {
      const label = String(item[labelField] ?? '');
      const schemas = Array.isArray(item.schemas) ? item.schemas : [];
      const type = schemas[0] ? String(schemas[0]) : 'default';
      return { x: 0, y: 0, vx: 0, vy: 0, label, type, data: item };
    });

    const computedEdges = buildEdges(rawNodes);
    const computedNodes = simulate(rawNodes, computedEdges, dimensions.width, dimensions.height);
    return { nodes: computedNodes, edges: computedEdges };
  }, [data, labelField, dimensions.width, dimensions.height]);

  // Resize observer
  useEffect(() => {
    const container = svgRef.current?.parentElement;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: Math.max(400, entry.contentRect.width),
          height: Math.max(300, Math.min(700, entry.contentRect.width * 0.55)),
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleNodeClick = useCallback((node: NodePosition) => {
    onRowClick?.(node.data);
  }, [onRowClick]);

  // Get edges connected to hovered node for highlighting
  const hoveredEdges = new Set<number>();
  const connectedNodes = new Set<number>();
  if (hoveredNode !== null) {
    connectedNodes.add(hoveredNode);
    edges.forEach((edge, idx) => {
      if (edge.source === hoveredNode || edge.target === hoveredNode) {
        hoveredEdges.add(idx);
        connectedNodes.add(edge.source);
        connectedNodes.add(edge.target);
      }
    });
  }

  // Collect unique types for legend
  const types = [...new Set(nodes.map((n) => n.type))];

  return (
    <div style={{ width: '100%' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        style={{
          width: '100%',
          height: dimensions.height,
          background: 'var(--palette-surface-variant)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--palette-outline-variant)',
        }}
      >
        {/* Arrowhead marker for sync edges */}
        <defs>
          <marker
            id="sync-arrow"
            viewBox="0 0 10 7"
            refX="10"
            refY="3.5"
            markerWidth="8"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--visualization-sync)" />
          </marker>
          <marker
            id="sync-arrow-highlight"
            viewBox="0 0 10 7"
            refX="10"
            refY="3.5"
            markerWidth="8"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--palette-primary)" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, idx) => {
          const s = nodes[edge.source];
          const t = nodes[edge.target];
          const highlighted = hoveredEdges.has(idx);
          const dimmed = hoveredNode !== null && !highlighted;
          const isSyncEdge = edge.isSync;
          const defaultStroke = isSyncEdge ? 'var(--visualization-sync)' : 'var(--visualization-edge-muted)';
          return (
            <line
              key={`edge-${idx}`}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke={highlighted ? 'var(--palette-primary)' : defaultStroke}
              strokeWidth={highlighted ? 2 : isSyncEdge ? 1.5 : 1}
              strokeOpacity={dimmed ? 0.15 : highlighted ? 1 : isSyncEdge ? 0.6 : 0.4}
              strokeDasharray={isSyncEdge ? '5 3' : undefined}
              markerEnd={isSyncEdge ? (highlighted ? 'url(#sync-arrow-highlight)' : 'url(#sync-arrow)') : undefined}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node, idx) => {
          const displayLabel = node.label
            .replace(/^(concept|schema|sync|suite|view|theme):/, '');
          const isHovered = hoveredNode === idx;
          const isConnected = connectedNodes.has(idx);
          const dimmed = hoveredNode !== null && !isConnected;
          const color = getTypeVisualizationColorToken(node.type);
          const nodeRadius = isHovered ? 8 : 6;
          const isSyncNode = node.type === 'Sync';

          return (
            <g
              key={`node-${idx}`}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              onClick={() => handleNodeClick(node)}
              onMouseEnter={() => setHoveredNode(idx)}
              onMouseLeave={() => setHoveredNode(null)}
              opacity={dimmed ? 0.25 : 1}
            >
              {isSyncNode ? (
                /* Sync nodes render as diamonds */
                <polygon
                  points={`${node.x},${node.y - nodeRadius} ${node.x + nodeRadius},${node.y} ${node.x},${node.y + nodeRadius} ${node.x - nodeRadius},${node.y}`}
                  fill={color}
                  stroke={isHovered ? 'var(--palette-on-surface)' : 'var(--palette-surface)'}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                />
              ) : (
                /* All other nodes render as circles */
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={nodeRadius}
                  fill={color}
                  stroke={isHovered ? 'var(--palette-on-surface)' : 'var(--palette-surface)'}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                />
              )}
              {/* Label */}
              <text
                x={node.x}
                y={node.y + nodeRadius + 12}
                textAnchor="middle"
                fill="var(--visualization-node-label)"
                fontSize={isHovered ? 11 : 9}
                fontFamily="var(--typography-font-family-mono)"
                fontWeight={isHovered ? 600 : 400}
              >
                {displayLabel}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--spacing-sm)',
        marginTop: 'var(--spacing-sm)',
        padding: 'var(--spacing-xs) var(--spacing-sm)',
      }}>
        {types.map((type) => (
          <div key={type} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: 'var(--typography-label-sm-size)',
            color: 'var(--palette-on-surface-variant)',
          }}>
            <span style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: type === 'Sync' ? '1px' : '50%',
              background: getTypeVisualizationColorToken(type),
              transform: type === 'Sync' ? 'rotate(45deg) scale(0.85)' : undefined,
            }} />
            {type}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GraphDisplay;
