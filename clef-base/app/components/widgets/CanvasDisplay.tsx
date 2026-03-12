'use client';

/**
 * CanvasDisplay — full canvas view display type for ViewRenderer.
 *
 * Renders the Surface canvas widget with force-directed graph layout,
 * pan/zoom, minimap, and the GraphAnalysisPanel for running analysis
 * algorithms on the displayed graph. Replaces the simple GraphDisplay
 * for views that need analysis capabilities.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Canvas } from '@clef/surface/domain/Canvas';
import { GraphAnalysisPanel } from '@clef/surface/domain/GraphAnalysisPanel';
import { useKernelInvoke } from '../../../lib/clef-provider';
import type { FieldConfig } from './TableDisplay';

// --------------- Types ---------------

interface NodePosition {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  label: string;
  type: string;
  data: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  sourceIdx: number;
  targetIdx: number;
}

interface CanvasDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
}

// --------------- Color Palette ---------------

const TYPE_COLORS: Record<string, string> = {
  concept: '#6366f1',
  schema: '#10b981',
  sync: '#f59e0b',
  suite: '#ec4899',
  workflow: '#8b5cf6',
  theme: '#06b6d4',
  view: '#3b82f6',
  'display-mode': '#14b8a6',
  'automation-rule': '#f97316',
  taxonomy: '#84cc16',
  'version-space': '#a855f7',
  default: '#64748b',
};

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] ?? TYPE_COLORS.default;
}

// --------------- Graph Building ---------------

function buildEdges(nodes: NodePosition[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const labelIndex = new Map<string, number>();
  nodes.forEach((n, i) => {
    labelIndex.set(n.id, i);
    labelIndex.set(n.label, i);
    const short = n.label.replace(/^(concept|schema|sync|suite|view|theme):/, '');
    if (short !== n.label) labelIndex.set(short, i);
  });

  nodes.forEach((node, sourceIdx) => {
    const content = node.data.content as string | undefined;
    if (!content) return;
    try {
      const parsed = JSON.parse(content);
      const pattern = parsed.pattern as string | undefined;
      if (pattern) {
        const parts = pattern.split(/\s*->\s*/);
        for (const part of parts) {
          const conceptName = part.split('/')[0]?.trim();
          if (conceptName) {
            const targetIdx = labelIndex.get(`concept:${conceptName}`);
            if (targetIdx !== undefined && targetIdx !== sourceIdx) {
              edges.push({
                source: node.id,
                target: nodes[targetIdx].id,
                sourceIdx,
                targetIdx,
              });
            }
          }
        }
      }
      const suite = parsed.suite as string | undefined;
      if (suite) {
        const targetIdx = labelIndex.get(`suite:${suite}`);
        if (targetIdx !== undefined && targetIdx !== sourceIdx) {
          edges.push({
            source: node.id,
            target: nodes[targetIdx].id,
            sourceIdx,
            targetIdx,
          });
        }
      }
    } catch { /* not JSON */ }
  });

  return edges;
}

function simulate(
  nodes: NodePosition[],
  width: number,
  height: number,
  edges: GraphEdge[],
  iterations = 120,
): NodePosition[] {
  const result = nodes.map((n) => ({ ...n }));
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

  const repulsion = 3000;
  const attraction = 0.005;
  const edgeLen = 120;
  const damping = 0.85;
  const gravity = 0.01;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const dx = result[i].x - result[j].x;
        const dy = result[i].y - result[j].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        result[i].vx += fx;
        result[i].vy += fy;
        result[j].vx -= fx;
        result[j].vy -= fy;
      }
    }

    for (const edge of edges) {
      const s = result[edge.sourceIdx];
      const t = result[edge.targetIdx];
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - edgeLen) * attraction;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx += fx;
      s.vy += fy;
      t.vx -= fx;
      t.vy -= fy;
    }

    for (const node of result) {
      node.vx += (cx - node.x) * gravity;
      node.vy += (cy - node.y) * gravity;
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;
      node.x = Math.max(60, Math.min(width - 60, node.x));
      node.y = Math.max(30, Math.min(height - 30, node.y));
    }
  }

  return result;
}

// --------------- Component ---------------

export const CanvasDisplay: React.FC<CanvasDisplayProps> = ({ data, fields, onRowClick }) => {
  const invoke = useKernelInvoke();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [zoom, setZoom] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [overlayColors, setOverlayColors] = useState<Record<string, string>>({});
  const [overlaySizes, setOverlaySizes] = useState<Record<string, number>>({});

  const labelField = fields[0]?.key ?? 'id';
  const typeField = fields[1]?.key ?? 'type';

  // Build graph from data
  const rawNodes: NodePosition[] = useMemo(() =>
    data.map((item, i) => {
      const label = String(item[labelField] ?? '');
      const type = String(item[typeField] ?? 'default');
      return { id: label || `node-${i}`, x: 0, y: 0, vx: 0, vy: 0, label, type, data: item };
    }),
    [data, labelField, typeField],
  );

  const edges = useMemo(() => buildEdges(rawNodes), [rawNodes]);
  const nodes = useMemo(
    () => simulate(rawNodes, dimensions.width, dimensions.height, edges),
    [rawNodes, dimensions.width, dimensions.height, edges],
  );

  // Build graph JSON for analysis panel
  const graphData = useMemo(() => {
    const graphNodes = nodes.map((n) => ({ id: n.id, label: n.label, type: n.type }));
    const graphEdges = edges.map((e) => ({ source: e.source, target: e.target }));
    return JSON.stringify({ nodes: graphNodes, edges: graphEdges });
  }, [nodes, edges]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: Math.max(600, entry.contentRect.width),
          height: Math.max(400, Math.min(800, entry.contentRect.width * 0.6)),
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Unique types for legend
  const types = useMemo(() => [...new Set(nodes.map((n) => n.type))], [nodes]);

  // Connected nodes for hover highlighting
  const connectedNodes = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const connected = new Set<string>([hoveredNode]);
    for (const edge of edges) {
      if (edge.source === hoveredNode) connected.add(edge.target);
      if (edge.target === hoveredNode) connected.add(edge.source);
    }
    return connected;
  }, [hoveredNode, edges]);

  // --- Kernel callbacks for analysis panel ---

  const handleRun = useCallback(async (algorithm: string, category: string, config?: string) => {
    const result = await invoke('GraphAnalysis', 'analyze', {
      graph: graphData,
      algorithm,
      category,
      config: config || '{}',
    });
    if (result.variant === 'ok' && result.result) {
      // Apply overlay colors from result
      try {
        const parsed = JSON.parse(result.result as string);
        if (parsed.scores) {
          const colors: Record<string, string> = {};
          const sizes: Record<string, number> = {};
          const entries = Object.entries(parsed.scores as Record<string, number>);
          const maxScore = Math.max(...entries.map(([, s]) => s), 0.001);
          for (const [id, score] of entries) {
            const t = score / maxScore;
            // blue→yellow→red gradient
            const h = t <= 0.5 ? 240 + (60 - 240) * (t / 0.5) : 60 + (0 - 60) * ((t - 0.5) / 0.5);
            colors[id] = `hsl(${Math.round(h)},80%,50%)`;
            sizes[id] = 0.5 + 2.5 * t;
          }
          setOverlayColors(colors);
          setOverlaySizes(sizes);
        }
      } catch { /* parse error */ }
    }
    return result;
  }, [invoke, graphData]);

  const handleOverlayToggle = useCallback((kind: string, enabled: boolean) => {
    if (!enabled) {
      if (kind === 'node-color') setOverlayColors({});
      if (kind === 'node-size') setOverlaySizes({});
    }
  }, []);

  const handleGenerateReport = useCallback(async (resultData: string, format: string) => {
    return invoke('AnalysisReport', 'generate', { result: resultData, format });
  }, [invoke]);

  const handleExport = useCallback(async (reportId: string, outputFormat: string) => {
    return invoke('AnalysisReport', 'exportReport', { report: reportId, outputFormat });
  }, [invoke]);

  // --- Render ---

  const nodeLayer = (
    <>
      {nodes.map((node) => {
        const isSelected = selectedIds.includes(node.id);
        const isHovered = hoveredNode === node.id;
        const isConnected = connectedNodes.has(node.id);
        const dimmed = hoveredNode !== null && !isConnected;
        const color = overlayColors[node.id] || getTypeColor(node.type);
        const scale = overlaySizes[node.id] || 1;
        const displayLabel = node.label.replace(/^(concept|schema|sync|suite|view|theme):/, '');

        return (
          <div
            key={node.id}
            data-part="canvas-node"
            data-node-id={node.id}
            data-node-type={node.type}
            data-selected={isSelected ? 'true' : 'false'}
            style={{
              position: 'absolute',
              left: node.x - 6 * scale,
              top: node.y - 6 * scale,
              opacity: dimmed ? 0.25 : 1,
              cursor: onRowClick ? 'pointer' : 'default',
              textAlign: 'center',
              transform: `translate(-50%, -50%)`,
            }}
            onClick={() => {
              setSelectedIds([node.id]);
              onRowClick?.(node.data);
            }}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            <svg width={16 * scale} height={16 * scale}>
              <circle
                cx={8 * scale}
                cy={8 * scale}
                r={6 * scale}
                fill={color}
                stroke={isHovered || isSelected ? 'var(--palette-on-surface, #1e293b)' : 'var(--palette-surface, #fff)'}
                strokeWidth={isHovered || isSelected ? 2.5 : 1.5}
              />
            </svg>
            <div style={{
              fontSize: isHovered ? 11 : 9,
              fontWeight: isHovered ? 600 : 400,
              fontFamily: 'var(--typography-font-family-mono, monospace)',
              color: 'var(--palette-on-surface, #1e293b)',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}>
              {displayLabel}
            </div>
          </div>
        );
      })}
    </>
  );

  const edgeLayer = (
    <>
      {edges.map((edge, idx) => {
        const s = nodes[edge.sourceIdx];
        const t = nodes[edge.targetIdx];
        const highlighted = hoveredNode !== null &&
          (edge.source === hoveredNode || edge.target === hoveredNode);
        const dimmed = hoveredNode !== null && !highlighted;

        return (
          <line
            key={`edge-${idx}`}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            stroke={highlighted ? 'var(--palette-primary, #6366f1)' : 'var(--palette-outline-variant, #cbd5e1)'}
            strokeWidth={highlighted ? 2 : 1}
            strokeOpacity={dimmed ? 0.15 : highlighted ? 1 : 0.4}
          />
        );
      })}
    </>
  );

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Canvas area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Canvas
            ariaLabel="Score Graph Canvas"
            zoom={zoom}
            panX={panX}
            panY={panY}
            gridVisible
            gridSize={20}
            selectedIds={selectedIds}
            onZoomChange={setZoom}
            onPanChange={(x, y) => { setPanX(x); setPanY(y); }}
            nodeLayer={nodeLayer}
            edgeLayer={edgeLayer}
            style={{
              width: '100%',
              height: dimensions.height,
              background: 'var(--palette-surface-variant, #f8fafc)',
              borderRadius: 'var(--radius-lg, 12px)',
              border: '1px solid var(--palette-outline-variant, #e2e8f0)',
              position: 'relative',
              overflow: 'hidden',
            }}
          />

          {/* Legend */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--spacing-sm, 8px)',
            marginTop: 'var(--spacing-sm, 8px)',
            padding: 'var(--spacing-xs, 4px) var(--spacing-sm, 8px)',
          }}>
            {types.map((type) => (
              <div key={type} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: 'var(--typography-label-sm-size, 11px)',
                color: 'var(--palette-on-surface-variant, #64748b)',
              }}>
                <span style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: getTypeColor(type),
                }} />
                {type}
              </div>
            ))}
          </div>
        </div>

        {/* Analysis panel — docked right */}
        <GraphAnalysisPanel
          canvasId="score-graph"
          selectedCategory="centrality"
          graphData={graphData}
          autoOverlay
          onRun={handleRun as never}
          onOverlayToggle={handleOverlayToggle}
          onGenerateReport={handleGenerateReport as never}
          onExport={handleExport as never}
          style={{
            width: 340,
            flexShrink: 0,
            borderLeft: '1px solid var(--palette-outline-variant, #e2e8f0)',
            background: 'var(--palette-surface, #fff)',
            maxHeight: dimensions.height + 40,
            overflowY: 'auto',
          }}
        />
      </div>
    </div>
  );
};

export default CanvasDisplay;
