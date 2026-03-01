'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { gvReducer } from './GraphView.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  label: string;
  type?: string;
  [k: string]: unknown;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  [k: string]: unknown;
}

export interface GraphViewProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Graph nodes. */
  nodes: GraphNode[];
  /** Graph edges. */
  edges: GraphEdge[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Node count (can override). */
  nodeCount?: number;
  /** Edge count (can override). */
  edgeCount?: number;
  /** Zoom level. */
  zoom?: number;
  /** Pan X. */
  panX?: number;
  /** Pan Y. */
  panY?: number;
  /** Selected node ID. */
  selectedNodeId?: string;
  /** Search query. */
  searchQuery?: string;
  /** Visible node types. */
  visibleTypes?: string[];
  /** Node render size. */
  nodeSize?: number;
  /** Link thickness. */
  linkThickness?: number;
  /** Force charge strength. */
  chargeStrength?: number;
  /** Force link distance. */
  linkDistance?: number;
  /** View mode. */
  viewMode?: 'global' | 'local';
  /** Whether simulation is running. */
  simulationRunning?: boolean;
  /** Whether filter panel is open. */
  filterPanelOpen?: boolean;
  /** Called on node select. */
  onNodeSelect?: (id: string) => void;
  /** Called on search. */
  onSearch?: (query: string) => void;
  /** Called on view mode change. */
  onViewModeChange?: (mode: 'global' | 'local') => void;
  /** Canvas rendering slot. */
  canvas?: ReactNode;
  /** Filter panel slot. */
  filterPanel?: ReactNode;
  /** Detail panel slot. */
  detailPanel?: ReactNode;
  /** Minimap slot. */
  minimap?: ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const GraphView = forwardRef<HTMLDivElement, GraphViewProps>(function GraphView(
  {
    nodes,
    edges,
    ariaLabel = 'Graph View',
    nodeCount,
    edgeCount,
    zoom = 1.0,
    panX = 0,
    panY = 0,
    selectedNodeId,
    searchQuery = '',
    visibleTypes = [],
    nodeSize = 8,
    linkThickness = 1.5,
    chargeStrength = -300,
    linkDistance = 100,
    viewMode = 'global',
    simulationRunning = true,
    filterPanelOpen = true,
    onNodeSelect,
    onSearch,
    onViewModeChange,
    canvas,
    filterPanel,
    detailPanel,
    minimap,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(gvReducer, {
    view: 'globalView',
    simulation: simulationRunning ? 'running' : 'paused',
  });

  const actualNodeCount = nodeCount ?? nodes.length;
  const actualEdgeCount = edgeCount ?? edges.length;

  return (
    <div
      ref={ref}
      role="application"
      aria-label={ariaLabel}
      aria-roledescription="graph visualization"
      data-surface-widget=""
      data-widget-name="graph-view"
      data-state={state.view}
      data-view-mode={viewMode}
      data-simulation={simulationRunning ? 'running' : 'paused'}
      {...rest}
    >
      <div
        data-part="canvas"
        role="img"
        aria-label={`Graph with ${actualNodeCount} nodes and ${actualEdgeCount} edges`}
        data-zoom={zoom}
        data-pan-x={panX}
        data-pan-y={panY}
        tabIndex={0}
        onPointerDown={() => send({ type: 'PAN_START' })}
        onPointerUp={() => send({ type: 'PAN_END' })}
      >
        {canvas ?? children}
      </div>

      {filterPanelOpen && (
        <div
          data-part="filter-panel"
          role="complementary"
          aria-label="Graph filters"
          data-visible="true"
        >
          {filterPanel ?? (
            <>
              <div data-part="search-input" aria-label="Search nodes">
                <input
                  type="text"
                  value={searchQuery}
                  aria-label="Search nodes"
                  placeholder="Search nodes..."
                  onChange={(e) => {
                    onSearch?.(e.target.value);
                    send({ type: e.target.value ? 'SEARCH' : 'CLEAR_SEARCH' });
                  }}
                />
              </div>
              <div data-part="type-toggles" role="group" aria-label="Node type filters" />
              <div data-part="display-controls" role="group" aria-label="Display settings">
                <div data-part="node-size-slider" aria-label="Node size" />
                <div data-part="link-thickness-slider" aria-label="Link thickness" />
              </div>
              <div data-part="force-controls" role="group" aria-label="Force simulation controls" />
            </>
          )}
        </div>
      )}

      {selectedNodeId && (
        <div
          data-part="detail-panel"
          role="complementary"
          aria-label="Node details"
          data-visible="true"
          data-node-id={selectedNodeId}
        >
          {detailPanel}
        </div>
      )}

      {minimap && (
        <div data-part="minimap" role="img" aria-label="Graph minimap" data-zoom={zoom} data-pan-x={panX} data-pan-y={panY}>
          {minimap}
        </div>
      )}

      <div
        data-part="mode-toggle"
        role="switch"
        aria-label="Toggle local neighborhood view"
        aria-checked={viewMode === 'local'}
        data-mode={viewMode}
        onClick={() => onViewModeChange?.(viewMode === 'global' ? 'local' : 'global')}
      />
    </div>
  );
});

GraphView.displayName = 'GraphView';
export { GraphView };
export default GraphView;
