'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
  type WheelEvent,
} from 'react';

import { canvasReducer, type CanvasTool } from './Canvas.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Array of canvas nodes (rendered via children). */
  nodes?: Array<{ id: string; x: number; y: number; [k: string]: unknown }>;
  /** Array of canvas edges. */
  edges?: Array<{ id: string; source: string; target: string; [k: string]: unknown }>;
  /** Active tool. */
  tool?: CanvasTool;
  /** Current zoom. */
  zoom?: number;
  /** Pan X. */
  panX?: number;
  /** Pan Y. */
  panY?: number;
  /** Grid size in px. */
  gridSize?: number;
  /** Show grid. */
  gridVisible?: boolean;
  /** Snap to grid. */
  snapToGrid?: boolean;
  /** Accessible label. */
  ariaLabel?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Currently selected node/edge IDs. */
  selectedIds?: string[];
  /** Zoom percentage for minimap. */
  viewportPercent?: number;
  /** Shape type for shape tool. */
  shapeType?: 'rectangle' | 'ellipse' | 'diamond' | 'triangle';
  /** Called on zoom change. */
  onZoomChange?: (zoom: number) => void;
  /** Called on pan change. */
  onPanChange?: (x: number, y: number) => void;
  /** Called on tool change. */
  onToolChange?: (tool: CanvasTool) => void;
  /** Node layer content. */
  nodeLayer?: ReactNode;
  /** Edge layer content. */
  edgeLayer?: ReactNode;
  /** Toolbar slot. */
  toolbar?: ReactNode;
  /** Minimap slot. */
  minimap?: ReactNode;
  /** Property panel slot. */
  propertyPanel?: ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const Canvas = forwardRef<HTMLDivElement, CanvasProps>(function Canvas(
  {
    nodes = [],
    edges = [],
    tool: controlledTool = 'select',
    zoom = 1.0,
    panX = 0,
    panY = 0,
    gridSize = 20,
    gridVisible = true,
    snapToGrid = false,
    ariaLabel = 'Canvas',
    readOnly = false,
    selectedIds = [],
    viewportPercent = 100,
    shapeType = 'rectangle',
    onZoomChange,
    onPanChange,
    onToolChange,
    nodeLayer,
    edgeLayer,
    toolbar,
    minimap,
    propertyPanel,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(canvasReducer, {
    tool: controlledTool,
    interaction: 'idle',
  });

  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const next = Math.max(0.1, Math.min(10.0, zoom + delta));
        onZoomChange?.(next);
      }
    },
    [zoom, onZoomChange],
  );

  return (
    <div
      ref={ref}
      role="application"
      aria-label={ariaLabel}
      aria-roledescription="canvas"
      data-surface-widget=""
      data-widget-name="canvas"
      data-tool={controlledTool}
      data-state={state.interaction}
      data-readonly={readOnly ? 'true' : 'false'}
      data-zoom={zoom}
      tabIndex={0}
      onWheel={handleWheel}
      {...rest}
    >
      {toolbar && (
        <div data-part="toolbar" aria-label="Canvas tools">
          {toolbar}
        </div>
      )}

      <div
        data-part="viewport"
        style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}
        data-zoom={zoom}
      >
        {gridVisible && (
          <div
            data-part="grid"
            data-visible="true"
            data-size={gridSize}
            data-zoom={zoom}
            aria-hidden="true"
          />
        )}

        <svg data-part="edge-layer" role="img" aria-label="Connections between nodes">
          {edgeLayer}
        </svg>

        <div data-part="node-layer" role="group" aria-label="Canvas nodes">
          {nodeLayer}
          {children}
        </div>

        {state.interaction === 'marquee' && (
          <div
            data-part="selection-box"
            data-visible="true"
            aria-hidden={state.interaction !== 'marquee' ? 'true' : undefined}
          />
        )}
      </div>

      {minimap && (
        <div data-part="minimap" role="img" aria-label={`Minimap: viewport at ${viewportPercent}% zoom`} data-zoom={zoom} data-pan-x={panX} data-pan-y={panY}>
          {minimap}
        </div>
      )}

      {selectedIds.length > 0 && propertyPanel && (
        <div data-part="property-panel" role="complementary" aria-label="Element properties" data-visible="true">
          {propertyPanel}
        </div>
      )}
    </div>
  );
});

Canvas.displayName = 'Canvas';
export { Canvas };
export default Canvas;
