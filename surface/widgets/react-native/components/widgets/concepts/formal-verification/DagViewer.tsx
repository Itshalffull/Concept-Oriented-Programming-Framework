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

import React, { forwardRef, useCallback, useMemo, useReducer, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

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

export interface DagViewerProps {
  nodes: DagNode[];
  edges: DagEdge[];
  layout?: 'dagre' | 'elk' | 'layered';
  zoom?: number;
  panX?: number;
  panY?: number;
  selectedNodeId?: string | undefined;
  onSelectNode?: (id: string | undefined) => void;
  children?: React.ReactNode;
}

function computeLevels(nodes: DagNode[], edges: DagEdge[]): Map<string, number> {
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) { inDeg.set(n.id, 0); adj.set(n.id, []); }
  for (const e of edges) { inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1); adj.get(e.from)?.push(e.to); }
  const levels = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, deg] of inDeg) { if (deg === 0) { queue.push(id); levels.set(id, 0); } }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curLvl = levels.get(cur)!;
    for (const child of adj.get(cur) ?? []) {
      const next = curLvl + 1;
      if ((levels.get(child) ?? -1) < next) levels.set(child, next);
      const nd = (inDeg.get(child) ?? 1) - 1;
      inDeg.set(child, nd);
      if (nd === 0) queue.push(child);
    }
  }
  for (const n of nodes) if (!levels.has(n.id)) levels.set(n.id, 0);
  return levels;
}

function groupByLevel(nodes: DagNode[], levels: Map<string, number>): DagNode[][] {
  const max = Math.max(0, ...levels.values());
  const groups: DagNode[][] = Array.from({ length: max + 1 }, () => []);
  for (const n of nodes) groups[levels.get(n.id) ?? 0].push(n);
  return groups;
}

const DagViewer = forwardRef<View, DagViewerProps>(function DagViewer(
  { nodes, edges, layout = 'dagre', selectedNodeId: controlledSelectedId, onSelectNode, children },
  ref,
) {
  const [state, send] = useReducer(dagViewerReducer, 'idle');
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(undefined);
  const selectedId = controlledSelectedId ?? internalSelectedId;

  const selectNode = useCallback((id: string | undefined) => {
    setInternalSelectedId(id);
    onSelectNode?.(id);
    send(id !== undefined ? { type: 'SELECT_NODE', id } : { type: 'DESELECT' });
  }, [onSelectNode]);

  const levels = useMemo(() => computeLevels(nodes, edges), [nodes, edges]);
  const levelGroups = useMemo(() => groupByLevel(nodes, levels), [nodes, levels]);
  const nodeMap = useMemo(() => { const m = new Map<string, DagNode>(); for (const n of nodes) m.set(n.id, n); return m; }, [nodes]);

  const upstream = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const s = new Set<string>();
    for (const e of edges) if (e.to === selectedId) s.add(e.from);
    return s;
  }, [selectedId, edges]);

  const downstream = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const s = new Set<string>();
    for (const e of edges) if (e.from === selectedId) s.add(e.to);
    return s;
  }, [selectedId, edges]);

  const connectedEdges = useMemo(() => selectedId ? edges.filter((e) => e.from === selectedId || e.to === selectedId) : [], [selectedId, edges]);
  const selectedNode = selectedId ? nodeMap.get(selectedId) : undefined;

  return (
    <View ref={ref} testID="dag-viewer" accessibilityRole="none" accessibilityLabel="Dependency graph" style={s.root}>
      <ScrollView style={s.canvas}>
        {levelGroups.map((group, lvlIdx) => (
          <View key={lvlIdx} style={s.level} accessibilityLabel={`Level ${lvlIdx}`}>
            {group.map((node) => {
              const isSel = node.id === selectedId;
              return (
                <Pressable key={node.id} onPress={() => selectNode(isSel ? undefined : node.id)}
                  accessibilityRole="button" accessibilityLabel={`${node.label} \u2014 ${node.status ?? 'unknown'}`}
                  accessibilityState={{ selected: isSel }} style={[s.node, isSel && s.nodeSel]}>
                  <Text style={s.nodeLabel}>{node.label}</Text>
                  {node.type && <Text style={s.badge}>{node.type}</Text>}
                  <Text style={s.badge}>{node.status ?? 'unknown'}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={s.edgeSection} accessibilityLabel="Graph edges">
        {edges.map((edge, idx) => (
          <Text key={`${edge.from}-${edge.to}-${idx}`} style={s.edgeText}>
            {nodeMap.get(edge.from)?.label ?? edge.from} {'\u2192'} {nodeMap.get(edge.to)?.label ?? edge.to}
            {edge.label ? ` (${edge.label})` : ''}
          </Text>
        ))}
      </View>

      {selectedNode && (
        <View style={s.detail} accessibilityLabel="Node details">
          <Text style={s.detailTitle}>{selectedNode.label}</Text>
          {selectedNode.type && <Text>Type: {selectedNode.type}</Text>}
          <Text>Status: {selectedNode.status ?? 'unknown'}</Text>
          <Text style={s.sectionTitle}>Upstream ({upstream.size}):</Text>
          {upstream.size > 0 ? [...upstream].map((id) => <Text key={id} style={s.item}>{nodeMap.get(id)?.label ?? id}</Text>) : <Text style={s.item}> None</Text>}
          <Text style={s.sectionTitle}>Downstream ({downstream.size}):</Text>
          {downstream.size > 0 ? [...downstream].map((id) => <Text key={id} style={s.item}>{nodeMap.get(id)?.label ?? id}</Text>) : <Text style={s.item}> None</Text>}
          <Text style={s.sectionTitle}>Connected edges ({connectedEdges.length}):</Text>
          {connectedEdges.length > 0 ? connectedEdges.map((ce, i) => (
            <Text key={i} style={s.item}>{nodeMap.get(ce.from)?.label ?? ce.from} {'\u2192'} {nodeMap.get(ce.to)?.label ?? ce.to}{ce.label ? ` (${ce.label})` : ''}</Text>
          )) : <Text style={s.item}> None</Text>}
        </View>
      )}
      {children && <View style={s.controls}>{children}</View>}
    </View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1 },
  canvas: { flex: 1 },
  level: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8 },
  node: { padding: 8, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, minWidth: 80, alignItems: 'center' },
  nodeSel: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  nodeLabel: { fontWeight: '600', fontSize: 13 },
  badge: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  edgeSection: { padding: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  edgeText: { fontSize: 12, color: '#4b5563', marginVertical: 1 },
  detail: { padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  detailTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  sectionTitle: { fontWeight: '600', marginTop: 8 },
  item: { fontSize: 13, paddingLeft: 12, marginVertical: 1 },
  controls: { padding: 8 },
});

DagViewer.displayName = 'DagViewer';
export { DagViewer };
export default DagViewer;
