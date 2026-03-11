'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from 'react';

import {
  createInitialState,
  screenToWorld,
  spatialCanvasViewportReducer,
  visibleItems,
  type Camera,
  type CanvasConnector,
  type CanvasItem,
  type MarqueeBounds,
} from './SpatialCanvasViewport.reducer.js';

/* ---------------------------------------------------------------------------
 * Props — derived from spatial-canvas-viewport.widget spec
 * ------------------------------------------------------------------------- */

export interface SpatialCanvasViewportProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  canvasId: string;
  canvasName?: string;
  cameraX?: number;
  cameraY?: number;
  zoom?: number;
  zoomMin?: number;
  zoomMax?: number;
  gridVisible?: boolean;
  gridSize?: number;
  gridStyle?: 'dots' | 'lines' | 'none';
  snapToGrid?: boolean;
  selectedItemIds?: string[];
  items?: CanvasItem[];
  connectors?: CanvasConnector[];
  backgroundFill?: string;

  /* Callbacks */
  onCameraChange?: (camera: Camera) => void;
  onSelectionChange?: (ids: string[]) => void;
  onItemPointerDown?: (id: string, e: PointerEvent) => void;
  onConnectorPointerDown?: (id: string, e: PointerEvent) => void;
  onContextMenuAction?: (action: string) => void;
  onDeleteSelected?: () => void;
  onNudge?: (direction: 'up' | 'down' | 'left' | 'right') => void;

  /* Slots */
  minimapSlot?: ReactNode;
  contextMenu?: ReactNode;
  /** Render function for each item. Falls back to plain div. */
  renderItem?: (item: CanvasItem) => ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Grid background CSS generators
 * ------------------------------------------------------------------------- */

function dotGridBackground(gridSize: number, zoom: number): string {
  const scaledSize = gridSize * zoom;
  return `radial-gradient(circle, #c0c0c0 1px, transparent 1px)`;
}

function lineGridBackground(_gridSize: number, _zoom: number): string {
  return `linear-gradient(to right, #e5e5e5 1px, transparent 1px), linear-gradient(to bottom, #e5e5e5 1px, transparent 1px)`;
}

/* ---------------------------------------------------------------------------
 * Connector SVG path
 * ------------------------------------------------------------------------- */

function connectorPath(
  source: CanvasItem | undefined,
  target: CanvasItem | undefined,
): string | null {
  if (!source || !target) return null;
  const sx = source.x + source.width / 2;
  const sy = source.y + source.height / 2;
  const tx = target.x + target.width / 2;
  const ty = target.y + target.height / 2;
  const mx = (sx + tx) / 2;
  return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;
}

/* ---------------------------------------------------------------------------
 * Marquee rect helper
 * ------------------------------------------------------------------------- */

function marqueeRect(m: MarqueeBounds) {
  return {
    left: Math.min(m.startX, m.currentX),
    top: Math.min(m.startY, m.currentY),
    width: Math.abs(m.currentX - m.startX),
    height: Math.abs(m.currentY - m.startY),
  };
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const SpatialCanvasViewport = forwardRef<HTMLDivElement, SpatialCanvasViewportProps>(
  function SpatialCanvasViewport(
    {
      canvasId,
      canvasName = '',
      cameraX = 0,
      cameraY = 0,
      zoom: controlledZoom = 1,
      zoomMin = 0.1,
      zoomMax = 5.0,
      gridVisible = true,
      gridSize = 20,
      gridStyle = 'dots',
      snapToGrid = true,
      selectedItemIds = [],
      items = [],
      connectors = [],
      backgroundFill = '#FAFAFA',
      onCameraChange,
      onSelectionChange,
      onItemPointerDown,
      onConnectorPointerDown,
      onContextMenuAction,
      onDeleteSelected,
      onNudge,
      minimapSlot,
      contextMenu,
      renderItem,
      children,
      style,
      ...rest
    },
    ref,
  ) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [state, send] = useReducer(
      spatialCanvasViewportReducer,
      { x: cameraX, y: cameraY, zoom: controlledZoom },
      createInitialState,
    );

    // Sync controlled camera back to reducer when props change externally
    useEffect(() => {
      send({
        type: 'SET_CAMERA',
        camera: { x: cameraX, y: cameraY, zoom: controlledZoom },
      });
    }, [cameraX, cameraY, controlledZoom]);

    // Notify parent of camera changes
    const prevCameraRef = useRef(state.camera);
    useEffect(() => {
      const prev = prevCameraRef.current;
      if (
        prev.x !== state.camera.x ||
        prev.y !== state.camera.y ||
        prev.zoom !== state.camera.zoom
      ) {
        prevCameraRef.current = state.camera;
        onCameraChange?.(state.camera);
      }
    }, [state.camera, onCameraChange]);

    // Notify parent of marquee selection changes
    useEffect(() => {
      if (state.interaction === 'idle' && state.marqueeSelectedIds.length > 0) {
        onSelectionChange?.(state.marqueeSelectedIds);
      }
    }, [state.interaction, state.marqueeSelectedIds, onSelectionChange]);

    // ---- Viewport rect cache ----
    const viewportRectRef = useRef<DOMRect | null>(null);
    const getViewportRect = useCallback(() => {
      if (!rootRef.current) return { left: 0, top: 0 };
      if (!viewportRectRef.current) {
        viewportRectRef.current = rootRef.current.getBoundingClientRect();
      }
      return viewportRectRef.current;
    }, []);

    // Invalidate rect cache on resize
    useEffect(() => {
      const el = rootRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => {
        viewportRectRef.current = null;
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    // ---- Wheel → zoom-at-point ----
    const handleWheel = useCallback(
      (e: WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        const rect = getViewportRect();
        send({
          type: 'ZOOM',
          delta: e.deltaY,
          clientX: e.clientX - rect.left,
          clientY: e.clientY - rect.top,
          zoomMin,
          zoomMax,
        });
      },
      [zoomMin, zoomMax, getViewportRect],
    );

    // ---- Pointer events ----
    const handlePointerDown = useCallback(
      (e: PointerEvent<HTMLDivElement>) => {
        // Right-click → context menu
        if (e.button === 2) return; // handled by onContextMenu

        // Middle-click or Space held → pan
        if (e.button === 1 || e.shiftKey) {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          send({ type: 'PAN_START', clientX: e.clientX, clientY: e.clientY });
          return;
        }

        // Left-click on empty area → marquee
        const rect = getViewportRect();
        const worldPt = screenToWorld(e.clientX, e.clientY, state.camera, rect);
        send({ type: 'MARQUEE_START', clientX: worldPt.x, clientY: worldPt.y });
      },
      [state.camera, getViewportRect],
    );

    const handlePointerMove = useCallback(
      (e: PointerEvent<HTMLDivElement>) => {
        if (state.interaction === 'panning') {
          send({ type: 'PAN_MOVE', clientX: e.clientX, clientY: e.clientY });
        } else if (state.interaction === 'selecting') {
          const rect = getViewportRect();
          const worldPt = screenToWorld(e.clientX, e.clientY, state.camera, rect);
          send({ type: 'MARQUEE_MOVE', clientX: worldPt.x, clientY: worldPt.y, items });
        }
      },
      [state.interaction, state.camera, items, getViewportRect],
    );

    const handlePointerUp = useCallback(
      (e: PointerEvent<HTMLDivElement>) => {
        if (state.interaction === 'panning') {
          (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
          send({ type: 'PAN_END' });
        } else if (state.interaction === 'selecting') {
          send({ type: 'MARQUEE_END' });
        }
      },
      [state.interaction],
    );

    const handleContextMenu = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        send({ type: 'CONTEXT_MENU', clientX: e.clientX, clientY: e.clientY });
      },
      [],
    );

    // ---- Keyboard ----
    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        // Zoom shortcuts
        if ((e.ctrlKey || e.metaKey) && e.key === '=') {
          e.preventDefault();
          send({ type: 'ZOOM', delta: -100, clientX: 0, clientY: 0, zoomMin, zoomMax });
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '-') {
          e.preventDefault();
          send({ type: 'ZOOM', delta: 100, clientX: 0, clientY: 0, zoomMin, zoomMax });
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
          e.preventDefault();
          send({ type: 'SET_CAMERA', camera: { ...state.camera, zoom: 1 } });
        }

        // Escape → close context menu
        if (e.key === 'Escape') {
          send({ type: 'CLOSE_MENU' });
        }

        // Delete
        if (e.key === 'Delete' || e.key === 'Backspace') {
          onDeleteSelected?.();
        }

        // Select all
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
          e.preventDefault();
          onSelectionChange?.(items.map((i) => i.id));
        }

        // Nudge
        const nudgeMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        };
        if (nudgeMap[e.key]) {
          e.preventDefault();
          onNudge?.(nudgeMap[e.key]);
        }

        // Space → pan mode
        if (e.key === ' ' && state.interaction === 'idle') {
          e.preventDefault();
        }
      },
      [state.camera, zoomMin, zoomMax, items, onDeleteSelected, onSelectionChange, onNudge, state.interaction],
    );

    // ---- Culled items ----
    const rootEl = rootRef.current;
    const viewportWidth = rootEl?.clientWidth ?? 800;
    const viewportHeight = rootEl?.clientHeight ?? 600;
    const culledItems = visibleItems(items, state.camera, viewportWidth, viewportHeight);

    // ---- Item map for connector lookups ----
    const itemMap = new Map(items.map((i) => [i.id, i]));

    // ---- Grid style ----
    const gridBg =
      gridStyle === 'dots'
        ? dotGridBackground(gridSize, state.camera.zoom)
        : gridStyle === 'lines'
          ? lineGridBackground(gridSize, state.camera.zoom)
          : 'none';
    const scaledGridSize = gridSize * state.camera.zoom;

    // ---- Cursor ----
    const cursor =
      state.interaction === 'panning'
        ? 'grabbing'
        : state.interaction === 'selecting'
          ? 'crosshair'
          : 'default';

    return (
      <div
        ref={(el) => {
          rootRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        role="application"
        aria-label={`Canvas: ${canvasName}`}
        aria-roledescription="spatial canvas"
        data-surface-widget=""
        data-widget-name="spatial-canvas-viewport"
        data-part="canvas-viewport"
        data-canvas={canvasId}
        data-zoom={state.camera.zoom}
        data-grid={gridVisible ? 'true' : 'false'}
        data-state={state.interaction}
        tabIndex={0}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          height: '100%',
          backgroundColor: backgroundFill,
          cursor,
          touchAction: 'none',
          outline: 'none',
          ...style,
        }}
        {...rest}
      >
        {/* ----- Viewport (transformed container) ----- */}
        <div
          data-part="viewport"
          style={{
            position: 'absolute',
            inset: 0,
            transformOrigin: '0 0',
            transform: `scale(${state.camera.zoom}) translate(${state.camera.x}px, ${state.camera.y}px)`,
            willChange: 'transform',
          }}
        >
          {/* ----- Grid layer ----- */}
          {gridVisible && gridStyle !== 'none' && (
            <div
              data-part="grid-layer"
              data-grid-style={gridStyle}
              data-grid-size={gridSize}
              data-visible="true"
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                backgroundImage: gridBg,
                backgroundSize: `${gridSize}px ${gridSize}px`,
                backgroundPosition: '0 0',
              }}
            />
          )}

          {/* ----- Item layer ----- */}
          <div data-part="item-layer" role="group" aria-label="Canvas items">
            {culledItems.map((item) => {
              const isSelected = selectedItemIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  data-item-id={item.id}
                  data-item-type={item.type}
                  data-selected={isSelected ? 'true' : 'false'}
                  style={{
                    position: 'absolute',
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: item.height,
                    outline: isSelected ? '2px solid #3b82f6' : undefined,
                    outlineOffset: isSelected ? '1px' : undefined,
                    cursor: 'pointer',
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onItemPointerDown?.(item.id, e);
                  }}
                >
                  {renderItem ? renderItem(item) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#fff',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        color: '#6b7280',
                      }}
                    >
                      {item.type}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ----- Connector layer ----- */}
          <svg
            data-part="connector-layer"
            role="group"
            aria-label="Connectors"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            {connectors.map((conn) => {
              const source = itemMap.get(conn.sourceId);
              const target = itemMap.get(conn.targetId);
              const d = connectorPath(source, target);
              if (!d) return null;
              return (
                <path
                  key={conn.id}
                  data-connector-id={conn.id}
                  d={d}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeLinecap="round"
                  style={{
                    pointerEvents: 'stroke',
                    cursor: 'pointer',
                    strokeDasharray: conn.lineStyle === 'dashed' ? '6 4' : undefined,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onConnectorPointerDown?.(conn.id, e as unknown as PointerEvent);
                  }}
                />
              );
            })}
          </svg>
        </div>

        {/* ----- Interaction layer (captures events above the viewport) ----- */}
        <div
          data-part="interaction-layer"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: state.interaction === 'panning' || state.interaction === 'selecting' ? 'auto' : 'none',
          }}
        />

        {/* ----- Selection marquee ----- */}
        {state.interaction === 'selecting' && state.marquee && (() => {
          const { camera } = state;
          const m = state.marquee;
          const left = Math.min(m.startX, m.currentX);
          const top = Math.min(m.startY, m.currentY);
          const width = Math.abs(m.currentX - m.startX);
          const height = Math.abs(m.currentY - m.startY);
          // Convert world coords to screen coords for rendering
          const screenLeft = (left + camera.x) * camera.zoom;
          const screenTop = (top + camera.y) * camera.zoom;
          const screenWidth = width * camera.zoom;
          const screenHeight = height * camera.zoom;
          return (
            <div
              data-part="selection-marquee"
              data-visible="true"
              role="presentation"
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: screenLeft,
                top: screenTop,
                width: screenWidth,
                height: screenHeight,
                border: '1px solid #3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                pointerEvents: 'none',
                zIndex: 50,
              }}
            />
          );
        })()}

        {/* ----- Context menu ----- */}
        {state.interaction === 'contextMenu' && state.contextMenuPos && (
          <div
            data-part="context-menu"
            style={{
              position: 'fixed',
              left: state.contextMenuPos.clientX,
              top: state.contextMenuPos.clientY,
              zIndex: 100,
            }}
            onClick={() => send({ type: 'ACTION' })}
          >
            {contextMenu}
          </div>
        )}

        {/* ----- Minimap slot ----- */}
        {minimapSlot && (
          <div
            data-part="minimap-slot"
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              zIndex: 40,
            }}
          >
            {minimapSlot}
          </div>
        )}

        {children}
      </div>
    );
  },
);

SpatialCanvasViewport.displayName = 'SpatialCanvasViewport';
export { SpatialCanvasViewport };
export default SpatialCanvasViewport;
export type { Camera, CanvasItem, CanvasConnector } from './SpatialCanvasViewport.reducer.js';
