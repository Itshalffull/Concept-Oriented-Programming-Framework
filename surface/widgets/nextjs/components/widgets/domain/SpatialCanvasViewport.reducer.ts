/* ---------------------------------------------------------------------------
 * SpatialCanvasViewport — State machine & reducer
 *
 * States: idle (initial) -> panning, selecting, contextMenu
 * Implements zoom-at-point, camera transforms, marquee selection bounds,
 * and viewport culling helpers.
 * ------------------------------------------------------------------------- */

// ---- Items & Connectors ---------------------------------------------------

export interface CanvasItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

export interface CanvasConnector {
  id: string;
  sourceId: string;
  targetId: string;
  lineStyle: string;
}

// ---- Camera ---------------------------------------------------------------

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

// ---- Marquee --------------------------------------------------------------

export interface MarqueeBounds {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// ---- Context Menu ---------------------------------------------------------

export interface ContextMenuPosition {
  clientX: number;
  clientY: number;
}

// ---- State ----------------------------------------------------------------

export type ViewportInteraction = 'idle' | 'panning' | 'selecting' | 'contextMenu';

export interface SpatialCanvasViewportState {
  interaction: ViewportInteraction;
  camera: Camera;
  /** Pointer position when pan began (screen coords). */
  panAnchor: { x: number; y: number } | null;
  /** Camera snapshot when pan began. */
  panCameraAnchor: { x: number; y: number } | null;
  /** Marquee rectangle in world coords. */
  marquee: MarqueeBounds | null;
  /** Context menu position in client coords. */
  contextMenuPos: ContextMenuPosition | null;
  /** IDs currently inside the marquee (computed during MARQUEE_MOVE). */
  marqueeSelectedIds: string[];
}

// ---- Events ---------------------------------------------------------------

export type SpatialCanvasViewportEvent =
  | { type: 'PAN_START'; clientX: number; clientY: number }
  | { type: 'PAN_MOVE'; clientX: number; clientY: number }
  | { type: 'PAN_END' }
  | { type: 'ZOOM'; delta: number; clientX: number; clientY: number; zoomMin: number; zoomMax: number }
  | { type: 'MARQUEE_START'; clientX: number; clientY: number }
  | { type: 'MARQUEE_MOVE'; clientX: number; clientY: number; items: CanvasItem[] }
  | { type: 'MARQUEE_END' }
  | { type: 'CONTEXT_MENU'; clientX: number; clientY: number }
  | { type: 'CLOSE_MENU' }
  | { type: 'ACTION' }
  | { type: 'SET_CAMERA'; camera: Camera };

// ---- Helpers --------------------------------------------------------------

/** Convert screen coords to world coords given current camera. */
export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: Camera,
  viewportRect: { left: number; top: number },
): { x: number; y: number } {
  const localX = screenX - viewportRect.left;
  const localY = screenY - viewportRect.top;
  return {
    x: localX / camera.zoom - camera.x,
    y: localY / camera.zoom - camera.y,
  };
}

/** Zoom-at-point: adjusts camera so the world point under the cursor stays fixed. */
function zoomAtPoint(
  camera: Camera,
  delta: number,
  clientX: number,
  clientY: number,
  viewportLeft: number,
  viewportTop: number,
  zoomMin: number,
  zoomMax: number,
): Camera {
  const zoomFactor = delta > 0 ? 0.95 : 1.05;
  const nextZoom = Math.min(zoomMax, Math.max(zoomMin, camera.zoom * zoomFactor));
  const localX = clientX - viewportLeft;
  const localY = clientY - viewportTop;
  // The world point under cursor before zoom:
  const worldX = localX / camera.zoom - camera.x;
  const worldY = localY / camera.zoom - camera.y;
  // Solve for new camera so that world point maps back to same screen pos:
  const newCameraX = localX / nextZoom - worldX;
  const newCameraY = localY / nextZoom - worldY;
  return { x: newCameraX, y: newCameraY, zoom: nextZoom };
}

/** Determine which items intersect the given marquee rectangle (world coords). */
export function itemsInMarquee(
  items: CanvasItem[],
  marquee: MarqueeBounds,
): string[] {
  const left = Math.min(marquee.startX, marquee.currentX);
  const right = Math.max(marquee.startX, marquee.currentX);
  const top = Math.min(marquee.startY, marquee.currentY);
  const bottom = Math.max(marquee.startY, marquee.currentY);
  return items
    .filter(
      (item) =>
        item.x + item.width >= left &&
        item.x <= right &&
        item.y + item.height >= top &&
        item.y <= bottom,
    )
    .map((item) => item.id);
}

/** Return items whose bounds overlap the visible viewport rect. */
export function visibleItems(
  items: CanvasItem[],
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
): CanvasItem[] {
  const left = -camera.x;
  const top = -camera.y;
  const right = left + viewportWidth / camera.zoom;
  const bottom = top + viewportHeight / camera.zoom;
  return items.filter(
    (item) =>
      item.x + item.width >= left &&
      item.x <= right &&
      item.y + item.height >= top &&
      item.y <= bottom,
  );
}

// ---- Initial state --------------------------------------------------------

export function createInitialState(camera?: Partial<Camera>): SpatialCanvasViewportState {
  return {
    interaction: 'idle',
    camera: { x: camera?.x ?? 0, y: camera?.y ?? 0, zoom: camera?.zoom ?? 1 },
    panAnchor: null,
    panCameraAnchor: null,
    marquee: null,
    contextMenuPos: null,
    marqueeSelectedIds: [],
  };
}

// ---- Reducer --------------------------------------------------------------

export function spatialCanvasViewportReducer(
  state: SpatialCanvasViewportState,
  event: SpatialCanvasViewportEvent,
): SpatialCanvasViewportState {
  switch (event.type) {
    // ----- Pan -----
    case 'PAN_START': {
      if (state.interaction !== 'idle') return state;
      return {
        ...state,
        interaction: 'panning',
        panAnchor: { x: event.clientX, y: event.clientY },
        panCameraAnchor: { x: state.camera.x, y: state.camera.y },
      };
    }

    case 'PAN_MOVE': {
      if (state.interaction !== 'panning' || !state.panAnchor || !state.panCameraAnchor) {
        // Also handle marquee move here if selecting
        if (state.interaction === 'selecting' && state.marquee) {
          // handled by MARQUEE_MOVE
        }
        return state;
      }
      const dx = (event.clientX - state.panAnchor.x) / state.camera.zoom;
      const dy = (event.clientY - state.panAnchor.y) / state.camera.zoom;
      return {
        ...state,
        camera: {
          ...state.camera,
          x: state.panCameraAnchor.x + dx,
          y: state.panCameraAnchor.y + dy,
        },
      };
    }

    case 'PAN_END': {
      if (state.interaction !== 'panning') return state;
      return {
        ...state,
        interaction: 'idle',
        panAnchor: null,
        panCameraAnchor: null,
      };
    }

    // ----- Zoom -----
    case 'ZOOM': {
      // Zoom-at-point — works from any state except contextMenu
      if (state.interaction === 'contextMenu') return state;
      // We approximate viewportLeft/Top as 0; the component compensates via ref.
      const newCamera = zoomAtPoint(
        state.camera,
        event.delta,
        event.clientX,
        event.clientY,
        0,
        0,
        event.zoomMin,
        event.zoomMax,
      );
      return { ...state, camera: newCamera };
    }

    // ----- Marquee selection -----
    case 'MARQUEE_START': {
      if (state.interaction !== 'idle') return state;
      return {
        ...state,
        interaction: 'selecting',
        marquee: {
          startX: event.clientX,
          startY: event.clientY,
          currentX: event.clientX,
          currentY: event.clientY,
        },
        marqueeSelectedIds: [],
      };
    }

    case 'MARQUEE_MOVE': {
      if (state.interaction !== 'selecting' || !state.marquee) return state;
      const updatedMarquee = {
        ...state.marquee,
        currentX: event.clientX,
        currentY: event.clientY,
      };
      return {
        ...state,
        marquee: updatedMarquee,
        marqueeSelectedIds: itemsInMarquee(event.items, updatedMarquee),
      };
    }

    case 'MARQUEE_END': {
      if (state.interaction !== 'selecting') return state;
      return {
        ...state,
        interaction: 'idle',
        marquee: null,
      };
    }

    // ----- Context menu -----
    case 'CONTEXT_MENU': {
      return {
        ...state,
        interaction: 'contextMenu',
        contextMenuPos: { clientX: event.clientX, clientY: event.clientY },
      };
    }

    case 'CLOSE_MENU':
    case 'ACTION': {
      if (state.interaction !== 'contextMenu') return state;
      return {
        ...state,
        interaction: 'idle',
        contextMenuPos: null,
      };
    }

    // ----- Direct camera set -----
    case 'SET_CAMERA': {
      return { ...state, camera: event.camera };
    }

    default:
      return state;
  }
}
