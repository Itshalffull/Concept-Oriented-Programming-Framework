import type { HTMLAttributes, ReactNode } from 'react';

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
      const nextLevel = currentLevel + 1;
      const existing = levels.get(child);
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

function getUpstream(nodeId: string, edges: DagEdge[]): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) { if (e.to === nodeId) ids.add(e.from); }
  return ids;
}

function getDownstream(nodeId: string, edges: DagEdge[]): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) { if (e.from === nodeId) ids.add(e.to); }
  return ids;
}

function getConnectedEdges(nodeId: string, edges: DagEdge[]): DagEdge[] {
  return edges.filter((e) => e.from === nodeId || e.to === nodeId);
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface DagViewerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  nodes: DagNode[];
  edges: DagEdge[];
  layout?: 'dagre' | 'elk' | 'layered';
  zoom?: number;
  panX?: number;
  panY?: number;
  selectedNodeId?: string | undefined;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function DagViewer({
  nodes,
  edges,
  layout = 'dagre',
  zoom = 1.0,
  panX = 0.0,
  panY = 0.0,
  selectedNodeId,
  children,
  ...rest
}: DagViewerProps) {
  const levels = computeLevels(nodes, edges);
  const levelGroups = groupByLevel(nodes, levels);

  const nodeMap = new Map<string, DagNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const upstream = selectedNodeId ? getUpstream(selectedNodeId, edges) : new Set<string>();
  const downstream = selectedNodeId ? getDownstream(selectedNodeId, edges) : new Set<string>();
  const connectedEdges = selectedNodeId ? getConnectedEdges(selectedNodeId, edges) : [];

  const isHighlighted = (id: string) =>
    id === selectedNodeId || upstream.has(id) || downstream.has(id);
  const isEdgeHighlighted = (edge: DagEdge) =>
    selectedNodeId !== undefined && (edge.from === selectedNodeId || edge.to === selectedNodeId);

  const state = selectedNodeId ? 'nodeSelected' : 'idle';

  return (
    <div
      role="application"
      aria-label="Dependency graph"
      data-surface-widget=""
      data-widget-name="dag-viewer"
      data-part="root"
      data-state={state}
      data-layout={layout}
      tabIndex={0}
      {...rest}
    >
      {/* Canvas */}
      <div
        data-part="canvas"
        data-state={state}
        data-zoom={zoom}
        data-pan-x={panX}
        data-pan-y={panY}
        role="list"
        aria-label={`DAG with ${nodes.length} nodes`}
      >
        {levelGroups.map((group, levelIdx) => (
          <div
            key={levelIdx}
            data-part="level"
            data-level={levelIdx}
            role="group"
            aria-label={`Level ${levelIdx}`}
          >
            {group.map((node) => {
              const isSelected = node.id === selectedNodeId;
              const highlighted = isHighlighted(node.id);

              return (
                <div
                  key={node.id}
                  data-part="node"
                  data-state={state}
                  data-status={node.status ?? 'unknown'}
                  data-selected={isSelected ? 'true' : 'false'}
                  data-highlighted={highlighted ? 'true' : 'false'}
                  role="button"
                  aria-label={`${node.label} \u2014 ${node.status ?? 'unknown'}`}
                  aria-pressed={isSelected}
                  tabIndex={-1}
                >
                  <span data-part="node-label" data-state={state}>{node.label}</span>
                  {node.type && (
                    <span data-part="node-badge" data-state={state} data-type={node.type}>{node.type}</span>
                  )}
                  <span data-part="node-badge" data-state={state} data-status={node.status ?? 'unknown'} aria-label={`Status: ${node.status ?? 'unknown'}`}>
                    {node.status ?? 'unknown'}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Edges */}
      <div data-part="edges" data-state={state} role="list" aria-label="Graph edges">
        {edges.map((edge, idx) => {
          const fromLabel = nodeMap.get(edge.from)?.label ?? edge.from;
          const toLabel = nodeMap.get(edge.to)?.label ?? edge.to;
          const highlighted = isEdgeHighlighted(edge);

          return (
            <div
              key={`${edge.from}-${edge.to}-${idx}`}
              data-part="edge"
              data-state={state}
              data-from={edge.from}
              data-to={edge.to}
              data-highlighted={highlighted ? 'true' : 'false'}
              role="listitem"
            >
              <span>{fromLabel} {'\u2192'} {toLabel}</span>
              {edge.label && <span data-part="edge-label" data-state={state}>{edge.label}</span>}
            </div>
          );
        })}
      </div>

      {/* Controls toolbar */}
      <div data-part="controls" data-state={state} role="toolbar" aria-label="Graph controls">
        {children}
      </div>

      {/* Detail panel */}
      <div
        data-part="detail-panel"
        data-state={state}
        data-visible={selectedNodeId !== undefined ? 'true' : 'false'}
        role="complementary"
        aria-label="Node details"
      >
        {selectedNodeId !== undefined && (() => {
          const selected = nodeMap.get(selectedNodeId);
          if (!selected) return null;

          return (
            <>
              <h3 data-part="detail-title">{selected.label}</h3>
              {selected.type && (
                <div data-part="detail-type"><strong>Type:</strong> {selected.type}</div>
              )}
              <div data-part="detail-status"><strong>Status:</strong> {selected.status ?? 'unknown'}</div>

              <div data-part="detail-upstream" aria-label="Upstream dependencies">
                <strong>Upstream ({upstream.size}):</strong>
                {upstream.size > 0 ? (
                  <ul>{[...upstream].map((id) => <li key={id}>{nodeMap.get(id)?.label ?? id}</li>)}</ul>
                ) : <span> None</span>}
              </div>

              <div data-part="detail-downstream" aria-label="Downstream dependents">
                <strong>Downstream ({downstream.size}):</strong>
                {downstream.size > 0 ? (
                  <ul>{[...downstream].map((id) => <li key={id}>{nodeMap.get(id)?.label ?? id}</li>)}</ul>
                ) : <span> None</span>}
              </div>

              <div data-part="detail-edges" aria-label="Connected edges">
                <strong>Connected edges ({connectedEdges.length}):</strong>
                {connectedEdges.length > 0 ? (
                  <ul>
                    {connectedEdges.map((ce, i) => {
                      const fl = nodeMap.get(ce.from)?.label ?? ce.from;
                      const tl = nodeMap.get(ce.to)?.label ?? ce.to;
                      return <li key={i}>{fl} {'\u2192'} {tl}{ce.label ? ` (${ce.label})` : ''}</li>;
                    })}
                  </ul>
                ) : <span> None</span>}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

export { DagViewer };
