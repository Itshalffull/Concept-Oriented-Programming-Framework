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

import {
  forwardRef,
  useCallback,
  useMemo,
  useReducer,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

export interface DagViewerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  nodes: DagNode[];
  edges: DagEdge[];
  layout?: 'dagre' | 'elk' | 'layered';
  zoom?: number;
  panX?: number;
  panY?: number;
  selectedNodeId?: string | undefined;
  onSelectNode?: (id: string | undefined) => void;
  children?: ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Topological sort — assign each node to a depth level               */
/* ------------------------------------------------------------------ */

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
    if (deg === 0) {
      queue.push(id);
      levels.set(id, 0);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current)!;
    for (const child of children.get(current) ?? []) {
      const existing = levels.get(child);
      const nextLevel = currentLevel + 1;
      if (existing === undefined || nextLevel > existing) {
        levels.set(child, nextLevel);
      }
      const newDeg = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, newDeg);
      if (newDeg === 0) {
        queue.push(child);
      }
    }
  }

  // Any nodes not reached (isolated) go to level 0
  for (const n of nodes) {
    if (!levels.has(n.id)) {
      levels.set(n.id, 0);
    }
  }

  return levels;
}

function groupByLevel(nodes: DagNode[], levels: Map<string, number>): DagNode[][] {
  const maxLevel = Math.max(0, ...levels.values());
  const groups: DagNode[][] = Array.from({ length: maxLevel + 1 }, () => []);
  for (const n of nodes) {
    groups[levels.get(n.id) ?? 0].push(n);
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/*  Connection helpers                                                 */
/* ------------------------------------------------------------------ */

function getUpstream(nodeId: string, edges: DagEdge[]): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) {
    if (e.to === nodeId) ids.add(e.from);
  }
  return ids;
}

function getDownstream(nodeId: string, edges: DagEdge[]): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) {
    if (e.from === nodeId) ids.add(e.to);
  }
  return ids;
}

function getConnectedEdges(nodeId: string, edges: DagEdge[]): DagEdge[] {
  return edges.filter((e) => e.from === nodeId || e.to === nodeId);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const DagViewer = forwardRef<HTMLDivElement, DagViewerProps>(function DagViewer(
  {
    nodes,
    edges,
    layout = 'dagre',
    zoom = 1.0,
    panX = 0.0,
    panY = 0.0,
    selectedNodeId: controlledSelectedId,
    onSelectNode,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(dagViewerReducer, 'idle');
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(undefined);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Support both controlled and uncontrolled selection
  const selectedId = controlledSelectedId ?? internalSelectedId;

  const selectNode = useCallback(
    (id: string | undefined) => {
      setInternalSelectedId(id);
      onSelectNode?.(id);
      if (id !== undefined) {
        send({ type: 'SELECT_NODE', id });
      } else {
        send({ type: 'DESELECT' });
      }
    },
    [onSelectNode],
  );

  // Compute topological levels and flatten for keyboard navigation order
  const levels = useMemo(() => computeLevels(nodes, edges), [nodes, edges]);
  const levelGroups = useMemo(() => groupByLevel(nodes, levels), [nodes, levels]);
  const flatNodes = useMemo(() => levelGroups.flat(), [levelGroups]);

  // Connection highlights for selected node
  const upstream = useMemo(
    () => (selectedId ? getUpstream(selectedId, edges) : new Set<string>()),
    [selectedId, edges],
  );
  const downstream = useMemo(
    () => (selectedId ? getDownstream(selectedId, edges) : new Set<string>()),
    [selectedId, edges],
  );
  const connectedEdges = useMemo(
    () => (selectedId ? getConnectedEdges(selectedId, edges) : []),
    [selectedId, edges],
  );

  const isHighlighted = useCallback(
    (id: string) => id === selectedId || upstream.has(id) || downstream.has(id),
    [selectedId, upstream, downstream],
  );

  const isEdgeHighlighted = useCallback(
    (edge: DagEdge) =>
      selectedId !== undefined && (edge.from === selectedId || edge.to === selectedId),
    [selectedId],
  );

  // Node label lookup for edge text
  const nodeMap = useMemo(() => {
    const m = new Map<string, DagNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  /* Keyboard navigation */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const count = flatNodes.length;
      if (count === 0) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setFocusedIndex((i) => Math.min(i + 1, count - 1));
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setFocusedIndex((i) => Math.max(i - 1, 0));
          break;
        }
        case 'Home': {
          e.preventDefault();
          setFocusedIndex(0);
          break;
        }
        case 'End': {
          e.preventDefault();
          setFocusedIndex(count - 1);
          break;
        }
        case 'Enter': {
          e.preventDefault();
          const node = flatNodes[focusedIndex];
          if (node) {
            selectNode(node.id === selectedId ? undefined : node.id);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          selectNode(undefined);
          break;
        }
        default:
          break;
      }
    },
    [flatNodes, focusedIndex, selectedId, selectNode],
  );

  return (
    <div
      ref={ref}
      role="application"
      aria-label="Dependency graph"
      data-surface-widget=""
      data-widget-name="dag-viewer"
      data-part="root"
      data-state={state}
      data-layout={layout}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...rest}
    >
      {/* Canvas — structured accessible list of nodes grouped by level */}
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
              const globalIdx = flatNodes.indexOf(node);
              const isFocused = globalIdx === focusedIndex;
              const isSelected = node.id === selectedId;
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
                  tabIndex={isFocused ? 0 : -1}
                  onClick={() => selectNode(isSelected ? undefined : node.id)}
                  ref={(el) => {
                    if (isFocused && el) el.focus();
                  }}
                >
                  <span data-part="node-label" data-state={state}>
                    {node.label}
                  </span>
                  {node.type && (
                    <span data-part="node-badge" data-state={state} data-type={node.type}>
                      {node.type}
                    </span>
                  )}
                  <span
                    data-part="node-badge"
                    data-state={state}
                    data-status={node.status ?? 'unknown'}
                    aria-label={`Status: ${node.status ?? 'unknown'}`}
                  >
                    {node.status ?? 'unknown'}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Edges rendered as text connections */}
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
              <span>
                {fromLabel} {'\u2192'} {toLabel}
              </span>
              {edge.label && (
                <span data-part="edge-label" data-state={state}>
                  {edge.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Controls toolbar */}
      <div data-part="controls" data-state={state} role="toolbar" aria-label="Graph controls">
        {children}
      </div>

      {/* Detail panel — visible when a node is selected */}
      <div
        data-part="detail-panel"
        data-state={state}
        data-visible={state === 'nodeSelected' || selectedId !== undefined ? 'true' : 'false'}
        role="complementary"
        aria-label="Node details"
      >
        {selectedId !== undefined && (() => {
          const selected = nodeMap.get(selectedId);
          if (!selected) return null;

          return (
            <>
              <h3 data-part="detail-title">{selected.label}</h3>
              {selected.type && (
                <div data-part="detail-type">
                  <strong>Type:</strong> {selected.type}
                </div>
              )}
              <div data-part="detail-status">
                <strong>Status:</strong> {selected.status ?? 'unknown'}
              </div>

              <div data-part="detail-upstream" aria-label="Upstream dependencies">
                <strong>Upstream ({upstream.size}):</strong>
                {upstream.size > 0 ? (
                  <ul>
                    {[...upstream].map((id) => (
                      <li key={id}>{nodeMap.get(id)?.label ?? id}</li>
                    ))}
                  </ul>
                ) : (
                  <span> None</span>
                )}
              </div>

              <div data-part="detail-downstream" aria-label="Downstream dependents">
                <strong>Downstream ({downstream.size}):</strong>
                {downstream.size > 0 ? (
                  <ul>
                    {[...downstream].map((id) => (
                      <li key={id}>{nodeMap.get(id)?.label ?? id}</li>
                    ))}
                  </ul>
                ) : (
                  <span> None</span>
                )}
              </div>

              <div data-part="detail-edges" aria-label="Connected edges">
                <strong>Connected edges ({connectedEdges.length}):</strong>
                {connectedEdges.length > 0 ? (
                  <ul>
                    {connectedEdges.map((ce, i) => {
                      const fl = nodeMap.get(ce.from)?.label ?? ce.from;
                      const tl = nodeMap.get(ce.to)?.label ?? ce.to;
                      return (
                        <li key={i}>
                          {fl} {'\u2192'} {tl}
                          {ce.label ? ` (${ce.label})` : ''}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <span> None</span>
                )}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
});

DagViewer.displayName = 'DagViewer';
export { DagViewer };
export default DagViewer;
