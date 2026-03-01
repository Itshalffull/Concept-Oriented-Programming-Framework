'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type PointerEvent,
  type ReactNode,
} from 'react';

import { minimapReducer } from './Minimap.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface MinimapProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Current zoom level. */
  zoom?: number;
  /** Pan X offset. */
  panX?: number;
  /** Pan Y offset. */
  panY?: number;
  /** Total content width. */
  contentWidth?: number;
  /** Total content height. */
  contentHeight?: number;
  /** Visible viewport width. */
  viewportWidth?: number;
  /** Visible viewport height. */
  viewportHeight?: number;
  /** Zoom percentage for display. */
  zoomPercent?: number;
  /** Viewport percentage. */
  viewportPercent?: number;
  /** Minimum zoom. */
  minZoom?: number;
  /** Maximum zoom. */
  maxZoom?: number;
  /** Called on zoom in. */
  onZoomIn?: () => void;
  /** Called on zoom out. */
  onZoomOut?: () => void;
  /** Called on zoom fit. */
  onZoomFit?: () => void;
  /** Called on pan change. */
  onPanChange?: (x: number, y: number) => void;
  /** Minimap canvas content. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const Minimap = forwardRef<HTMLDivElement, MinimapProps>(function Minimap(
  {
    zoom = 1.0,
    panX = 0,
    panY = 0,
    contentWidth = 1000,
    contentHeight = 1000,
    viewportWidth = 800,
    viewportHeight = 600,
    zoomPercent = 100,
    viewportPercent = 100,
    minZoom = 0.1,
    maxZoom = 10.0,
    onZoomIn,
    onZoomOut,
    onZoomFit,
    onPanChange,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(minimapReducer, 'idle');

  const handleViewportPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      send({ type: 'PAN_START' });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handleViewportPointerUp = useCallback(() => {
    send({ type: 'PAN_END' });
  }, []);

  const handleViewportPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (state !== 'panning') return;
      onPanChange?.(e.movementX, e.movementY);
    },
    [state, onPanChange],
  );

  const scale = Math.min(200 / contentWidth, 150 / contentHeight);
  const vpWidth = (viewportWidth / zoom) * scale;
  const vpHeight = (viewportHeight / zoom) * scale;
  const vpLeft = (-panX / zoom) * scale;
  const vpTop = (-panY / zoom) * scale;

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Minimap"
      aria-roledescription="minimap"
      data-surface-widget=""
      data-widget-name="minimap"
      data-part="minimap"
      data-state={state}
      {...rest}
    >
      <div
        data-part="minimap-canvas"
        role="img"
        aria-label="Content overview"
        aria-hidden="true"
        data-content-width={contentWidth}
        data-content-height={contentHeight}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        {children}
        <div
          data-part="viewport"
          role="slider"
          aria-label="Viewport position"
          aria-roledescription="viewport indicator"
          aria-valuetext={`Viewing ${viewportPercent}% of content at ${zoomPercent}% zoom`}
          tabIndex={0}
          style={{
            position: 'absolute',
            left: `${vpLeft}px`,
            top: `${vpTop}px`,
            width: `${vpWidth}px`,
            height: `${vpHeight}px`,
            cursor: state === 'panning' ? 'grabbing' : 'grab',
          }}
          onPointerDown={handleViewportPointerDown}
          onPointerUp={handleViewportPointerUp}
          onPointerMove={handleViewportPointerMove}
        />
      </div>

      <div data-part="zoom-controls" role="group" aria-label="Zoom controls">
        <button
          type="button"
          role="button"
          aria-label="Zoom in"
          data-part="zoom-in"
          aria-disabled={zoom >= maxZoom || undefined}
          onClick={onZoomIn}
        >
          +
        </button>
        <button
          type="button"
          role="button"
          aria-label="Zoom out"
          data-part="zoom-out"
          aria-disabled={zoom <= minZoom || undefined}
          onClick={onZoomOut}
        >
          -
        </button>
        <button
          type="button"
          role="button"
          aria-label="Fit content to view"
          data-part="zoom-fit"
          onClick={onZoomFit}
        >
          Fit
        </button>
        <span data-part="zoom-level" role="status" aria-live="polite" aria-label={`Zoom: ${zoomPercent}%`}>
          {zoomPercent}%
        </span>
      </div>
    </div>
  );
});

Minimap.displayName = 'Minimap';
export { Minimap };
export default Minimap;
