/* ---------------------------------------------------------------------------
 * DagViewer — Ink (terminal) implementation
 * Directed acyclic graph viewer for dependency visualization
 * See widget spec: dag-viewer.widget
 * ------------------------------------------------------------------------- */

export type DagViewerState = 'idle' | 'nodeSelected' | 'computing';
export type DagViewerEvent =
  | { type: 'SELECT_NODE'; id?: string }
  | { type: 'ZOOM' }
  | { type: 'PAN' }
  | { type: 'LAYOUT' }
  | { type: 'DESELECT' }
  | { type: 'LAYOUT_COMPLETE' };

export function dagViewerReducer(state: DagViewerState, event: DagViewerEvent): DagViewerState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_NODE') return 'nodeSelected';
      if (event.type === 'ZOOM') return 'idle';
      if (event.type === 'PAN') return 'idle';
      if (event.type === 'LAYOUT') return 'computing';
      return state;
    case 'nodeSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_NODE') return 'nodeSelected';
      return state;
    case 'computing':
      if (event.type === 'LAYOUT_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface DagNode {
  id: string;
  label: string;
  type?: string;
  status?: string;
}

export interface DagEdge {
  from: string;
  to: string;
  label?: string;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const STATUS_ICONS: Record<string, string> = {
  proved: '\u2713',
  passed: '\u2713',
  failed: '\u2717',
  running: '\u25CF',
  pending: '\u25CB',
  unknown: '?',
};

const STATUS_COLORS: Record<string, string> = {
  proved: 'green',
  passed: 'green',
  failed: 'red',
  running: 'cyan',
  pending: 'gray',
  unknown: 'yellow',
};

function computeLevels(nodes: DagNode[], edges: DagEdge[]): Map<string, number> {
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    inDegree.set(n.id, 0);
    children.set(n.id, []);
  }
  for (const e of edges) {
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    children.get(e.from)?.push(e.to);
  }
  const levels = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) { queue.push(id); levels.set(id, 0); }
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current)!;
    for (const child of children.get(current) ?? []) {
      const existing = levels.get(child);
      const nextLevel = currentLevel + 1;
      if (existing === undefined || nextLevel > existing) levels.set(child, nextLevel);
      const newDeg = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, newDeg);
      if (newDeg === 0) queue.push(child);
    }
  }
  for (const n of nodes) {
    if (!levels.has(n.id)) levels.set(n.id, 0);
  }
  return levels;
}

function groupByLevel(nodes: DagNode[], levels: Map<string, number>): DagNode[][] {
  const maxLevel = Math.max(0, ...levels.values());
  const groups: DagNode[][] = Array.from({ length: maxLevel + 1 }, () => []);
  for (const n of nodes) groups[levels.get(n.id) ?? 0].push(n);
  return groups;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface DagViewerProps {
  nodes: DagNode[];
  edges: DagEdge[];
  layout?: 'dagre' | 'elk' | 'layered';
  zoom?: number;
  panX?: number;
  panY?: number;
  selectedNodeId?: string | undefined;
  onSelectNode?: (id: string | undefined) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export function DagViewer({
  nodes,
  edges,
  layout = 'dagre',
  selectedNodeId: controlledSelectedId,
  onSelectNode,
}: DagViewerProps) {
  const [state, send] = useReducer(dagViewerReducer, 'idle');
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(undefined);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const selectedId = controlledSelectedId ?? internalSelectedId;

  const selectNode = useCallback(
    (id: string | undefined) => {
      setInternalSelectedId(id);
      onSelectNode?.(id);
      if (id !== undefined) send({ type: 'SELECT_NODE', id });
      else send({ type: 'DESELECT' });
    },
    [onSelectNode],
  );

  const levels = useMemo(() => computeLevels(nodes, edges), [nodes, edges]);
  const levelGroups = useMemo(() => groupByLevel(nodes, levels), [nodes, levels]);
  const flatNodes = useMemo(() => levelGroups.flat(), [levelGroups]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, DagNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  // Connected nodes for highlighting
  const upstream = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return new Set(edges.filter((e) => e.to === selectedId).map((e) => e.from));
  }, [selectedId, edges]);

  const downstream = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return new Set(edges.filter((e) => e.from === selectedId).map((e) => e.to));
  }, [selectedId, edges]);

  useInput((input, key) => {
    const count = flatNodes.length;
    if (count === 0) return;

    if (key.downArrow) {
      setFocusedIndex((i) => Math.min(i + 1, count - 1));
    } else if (key.upArrow) {
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (key.return) {
      const node = flatNodes[focusedIndex];
      if (node) selectNode(node.id === selectedId ? undefined : node.id);
    } else if (key.escape) {
      selectNode(undefined);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round">
      <Box>
        <Text bold>DAG Viewer</Text>
        <Text dimColor> ({nodes.length} nodes, {edges.length} edges)</Text>
      </Box>

      <Box><Text dimColor>{'\u2500'.repeat(50)}</Text></Box>

      {/* Nodes by level */}
      {levelGroups.map((group, levelIdx) => (
        <Box key={levelIdx} flexDirection="column">
          <Box>
            <Text dimColor>Level {levelIdx}: </Text>
          </Box>
          {group.map((node) => {
            const globalIdx = flatNodes.indexOf(node);
            const isFocused = globalIdx === focusedIndex;
            const isSelected = node.id === selectedId;
            const isHighlighted = isSelected || upstream.has(node.id) || downstream.has(node.id);
            const statusIcon = STATUS_ICONS[node.status ?? 'unknown'] ?? '?';
            const statusColor = STATUS_COLORS[node.status ?? 'unknown'] ?? 'white';

            return (
              <Box key={node.id}>
                <Text>  </Text>
                <Text bold={isFocused} inverse={isSelected} dimColor={!isHighlighted && !!selectedId}>
                  {isFocused ? '\u25B6 ' : '  '}
                </Text>
                <Text color={statusColor}>{statusIcon}</Text>
                <Text bold={isSelected}> {node.label}</Text>
                {node.type && <Text dimColor> [{node.type}]</Text>}
              </Box>
            );
          })}
        </Box>
      ))}

      {/* Edges */}
      <Box><Text dimColor>{'\u2500'.repeat(50)}</Text></Box>
      <Box flexDirection="column">
        <Text dimColor>Edges:</Text>
        {edges.map((edge, idx) => {
          const fromLabel = nodeMap.get(edge.from)?.label ?? edge.from;
          const toLabel = nodeMap.get(edge.to)?.label ?? edge.to;
          const highlighted = selectedId !== undefined && (edge.from === selectedId || edge.to === selectedId);

          return (
            <Box key={idx}>
              <Text dimColor={!highlighted}>
                  {fromLabel} \u2192 {toLabel}
                {edge.label ? ` (${edge.label})` : ''}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Detail panel */}
      {selectedId && nodeMap.get(selectedId) && (
        <>
          <Box><Text dimColor>{'\u2500'.repeat(50)}</Text></Box>
          <Box flexDirection="column">
            <Box><Text bold>{nodeMap.get(selectedId)!.label}</Text></Box>
            {nodeMap.get(selectedId)!.type && (
              <Box><Text>Type: {nodeMap.get(selectedId)!.type}</Text></Box>
            )}
            <Box><Text>Status: {nodeMap.get(selectedId)!.status ?? 'unknown'}</Text></Box>
            <Box><Text>Upstream: {upstream.size} | Downstream: {downstream.size}</Text></Box>
          </Box>
        </>
      )}

      <Box><Text dimColor>{'\u2500'.repeat(50)}</Text></Box>
      <Box>
        <Text dimColor>\u2191\u2193 navigate  Enter select  Esc deselect</Text>
      </Box>
    </Box>
  );
}

export default DagViewer;
