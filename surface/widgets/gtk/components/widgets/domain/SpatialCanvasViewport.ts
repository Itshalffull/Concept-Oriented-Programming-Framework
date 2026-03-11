// ============================================================
// Clef Surface GTK Widget — SpatialCanvasViewport
//
// Primary spatial editing surface using GtkDrawingArea + Cairo
// for rendering, with GtkGesture controllers for pan, zoom,
// and long-press. Implements the spatial-canvas-viewport.widget
// spec: camera transforms, layered rendering (grid, items,
// connectors, marquee), viewport culling, and the full state
// machine (idle, panning, selecting, contextMenu).
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';

// --------------- Types ---------------

export interface SpatialCanvasItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

export interface SpatialCanvasConnector {
  id: string;
  sourceId: string;
  targetId: string;
  lineStyle: string; // "solid" | "dashed"
}

export interface SpatialCamera {
  x: number;
  y: number;
  zoom: number;
}

export interface SpatialCanvasViewportProps {
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
  items?: SpatialCanvasItem[];
  connectors?: SpatialCanvasConnector[];
  backgroundFill?: [number, number, number, number]; // RGBA 0..1
  onCameraChange?: (camera: SpatialCamera) => void;
  onSelectionChange?: (ids: string[]) => void;
  onItemPress?: (id: string) => void;
  onDeleteSelected?: () => void;
}

// --------------- State machine ---------------

type Interaction = 'idle' | 'panning' | 'selecting' | 'contextMenu';

interface ViewportState {
  interaction: Interaction;
  camera: SpatialCamera;
  panAnchor: { x: number; y: number } | null;
  panCameraAnchor: { x: number; y: number } | null;
  marqueeStart: { x: number; y: number } | null;
  marqueeEnd: { x: number; y: number } | null;
}

function createState(camera?: Partial<SpatialCamera>): ViewportState {
  return {
    interaction: 'idle',
    camera: { x: camera?.x ?? 0, y: camera?.y ?? 0, zoom: camera?.zoom ?? 1 },
    panAnchor: null,
    panCameraAnchor: null,
    marqueeStart: null,
    marqueeEnd: null,
  };
}

// --------------- Helpers ---------------

function screenToWorld(
  sx: number,
  sy: number,
  cam: SpatialCamera,
): { x: number; y: number } {
  return {
    x: sx / cam.zoom - cam.x,
    y: sy / cam.zoom - cam.y,
  };
}

function worldToScreen(
  wx: number,
  wy: number,
  cam: SpatialCamera,
): { x: number; y: number } {
  return {
    x: (wx + cam.x) * cam.zoom,
    y: (wy + cam.y) * cam.zoom,
  };
}

function isItemVisible(
  item: SpatialCanvasItem,
  cam: SpatialCamera,
  vpW: number,
  vpH: number,
): boolean {
  const left = -cam.x;
  const top = -cam.y;
  const right = left + vpW / cam.zoom;
  const bottom = top + vpH / cam.zoom;
  return (
    item.x + item.width >= left &&
    item.x <= right &&
    item.y + item.height >= top &&
    item.y <= bottom
  );
}

function marqueeIntersects(
  item: SpatialCanvasItem,
  s: { x: number; y: number },
  e: { x: number; y: number },
): boolean {
  const left = Math.min(s.x, e.x);
  const right = Math.max(s.x, e.x);
  const top = Math.min(s.y, e.y);
  const bottom = Math.max(s.y, e.y);
  return (
    item.x + item.width >= left &&
    item.x <= right &&
    item.y + item.height >= top &&
    item.y <= bottom
  );
}

function hitTestItem(
  items: SpatialCanvasItem[],
  worldX: number,
  worldY: number,
): SpatialCanvasItem | null {
  for (const item of items) {
    if (
      worldX >= item.x && worldX <= item.x + item.width &&
      worldY >= item.y && worldY <= item.y + item.height
    ) {
      return item;
    }
  }
  return null;
}

// --------------- Component ---------------

export function createSpatialCanvasViewport(
  props: SpatialCanvasViewportProps,
): Gtk.Widget {
  const {
    canvasId,
    canvasName = '',
    cameraX = 0,
    cameraY = 0,
    zoom: initialZoom = 1,
    zoomMin = 0.1,
    zoomMax = 5.0,
    gridVisible = true,
    gridSize = 20,
    gridStyle = 'dots',
    snapToGrid = true,
    selectedItemIds = [],
    items = [],
    connectors = [],
    backgroundFill = [0.98, 0.98, 0.98, 1],
    onCameraChange,
    onSelectionChange,
    onItemPress,
    onDeleteSelected,
  } = props;

  const state = createState({ x: cameraX, y: cameraY, zoom: initialZoom });
  let selectedIds = new Set(selectedItemIds);

  // --- Drawing area ---
  const drawingArea = new Gtk.DrawingArea({
    widthRequest: 800,
    heightRequest: 600,
    hexpand: true,
    vexpand: true,
    focusable: true,
    canFocus: true,
  });

  // Accessibility
  drawingArea.set_accessible_role(Gtk.AccessibleRole.GROUP);

  // --- Draw function ---
  drawingArea.set_draw_func(
    (_area: Gtk.DrawingArea, cr: any, vpW: number, vpH: number) => {
      const cam = state.camera;

      // Background
      cr.setSourceRGBA(...backgroundFill);
      cr.rectangle(0, 0, vpW, vpH);
      cr.fill();

      // Apply camera transform
      cr.save();
      cr.scale(cam.zoom, cam.zoom);
      cr.translate(cam.x, cam.y);

      // --- Grid layer ---
      if (gridVisible && gridStyle !== 'none') {
        const visLeft = -cam.x;
        const visTop = -cam.y;
        const visWidth = vpW / cam.zoom;
        const visHeight = vpH / cam.zoom;

        if (gridStyle === 'dots') {
          cr.setSourceRGBA(0.7, 0.7, 0.7, 0.5);
          for (
            let gx = Math.floor(visLeft / gridSize) * gridSize;
            gx <= visLeft + visWidth;
            gx += gridSize
          ) {
            for (
              let gy = Math.floor(visTop / gridSize) * gridSize;
              gy <= visTop + visHeight;
              gy += gridSize
            ) {
              cr.arc(gx, gy, 0.8, 0, 2 * Math.PI);
              cr.fill();
            }
          }
        } else {
          // lines
          cr.setSourceRGBA(0.8, 0.8, 0.8, 0.35);
          cr.setLineWidth(0.5 / cam.zoom);
          for (
            let gx = Math.floor(visLeft / gridSize) * gridSize;
            gx <= visLeft + visWidth;
            gx += gridSize
          ) {
            cr.moveTo(gx, visTop);
            cr.lineTo(gx, visTop + visHeight);
          }
          for (
            let gy = Math.floor(visTop / gridSize) * gridSize;
            gy <= visTop + visHeight;
            gy += gridSize
          ) {
            cr.moveTo(visLeft, gy);
            cr.lineTo(visLeft + visWidth, gy);
          }
          cr.stroke();
        }
      }

      // --- Connector layer ---
      const itemMap = new Map(items.map((i) => [i.id, i]));
      for (const conn of connectors) {
        const src = itemMap.get(conn.sourceId);
        const tgt = itemMap.get(conn.targetId);
        if (!src || !tgt) continue;

        const sx = src.x + src.width / 2;
        const sy = src.y + src.height / 2;
        const tx = tgt.x + tgt.width / 2;
        const ty = tgt.y + tgt.height / 2;
        const mx = (sx + tx) / 2;

        cr.setSourceRGBA(0.58, 0.64, 0.72, 0.7);
        cr.setLineWidth(2 / cam.zoom);
        if (conn.lineStyle === 'dashed') {
          cr.setDash([6 / cam.zoom, 4 / cam.zoom], 0);
        } else {
          cr.setDash([], 0);
        }

        cr.moveTo(sx, sy);
        cr.curveTo(mx, sy, mx, ty, tx, ty);
        cr.stroke();
      }

      // --- Item layer (viewport-culled) ---
      const culled = items.filter((item) =>
        isItemVisible(item, cam, vpW, vpH),
      );

      for (const item of culled) {
        const isSelected = selectedIds.has(item.id);

        // Background
        cr.setSourceRGBA(1, 1, 1, 1);
        const r = 4;
        cr.newPath();
        cr.arc(item.x + r, item.y + r, r, Math.PI, 1.5 * Math.PI);
        cr.arc(item.x + item.width - r, item.y + r, r, 1.5 * Math.PI, 2 * Math.PI);
        cr.arc(item.x + item.width - r, item.y + item.height - r, r, 0, 0.5 * Math.PI);
        cr.arc(item.x + r, item.y + item.height - r, r, 0.5 * Math.PI, Math.PI);
        cr.closePath();
        cr.fill();

        // Border
        if (isSelected) {
          cr.setSourceRGBA(0.23, 0.51, 0.96, 1); // blue-500
          cr.setLineWidth(2 / cam.zoom);
        } else {
          cr.setSourceRGBA(0.82, 0.84, 0.86, 1); // gray-300
          cr.setLineWidth(1 / cam.zoom);
        }
        cr.setDash([], 0);
        cr.newPath();
        cr.arc(item.x + r, item.y + r, r, Math.PI, 1.5 * Math.PI);
        cr.arc(item.x + item.width - r, item.y + r, r, 1.5 * Math.PI, 2 * Math.PI);
        cr.arc(item.x + item.width - r, item.y + item.height - r, r, 0, 0.5 * Math.PI);
        cr.arc(item.x + r, item.y + item.height - r, r, 0.5 * Math.PI, Math.PI);
        cr.closePath();
        cr.stroke();

        // Type label
        cr.setSourceRGBA(0.42, 0.45, 0.5, 1); // gray-500
        cr.setFontSize(10 / cam.zoom);
        const extents = cr.textExtents(item.type);
        cr.moveTo(
          item.x + item.width / 2 - extents.width / 2,
          item.y + item.height / 2 + extents.height / 2,
        );
        cr.showText(item.type);
      }

      cr.restore();

      // --- Selection marquee (screen coords) ---
      if (
        state.interaction === 'selecting' &&
        state.marqueeStart &&
        state.marqueeEnd
      ) {
        const s = worldToScreen(state.marqueeStart.x, state.marqueeStart.y, cam);
        const e = worldToScreen(state.marqueeEnd.x, state.marqueeEnd.y, cam);
        const ml = Math.min(s.x, e.x);
        const mt = Math.min(s.y, e.y);
        const mw = Math.abs(e.x - s.x);
        const mh = Math.abs(e.y - s.y);

        cr.setSourceRGBA(0.23, 0.51, 0.96, 0.08);
        cr.rectangle(ml, mt, mw, mh);
        cr.fill();
        cr.setSourceRGBA(0.23, 0.51, 0.96, 1);
        cr.setLineWidth(1);
        cr.rectangle(ml, mt, mw, mh);
        cr.stroke();
      }
    },
  );

  // --- Gesture: drag (pan or marquee) ---
  const dragGesture = new Gtk.GestureDrag();
  dragGesture.set_button(0); // any button

  dragGesture.connect('drag-begin', (_gesture: any, startX: number, startY: number) => {
    drawingArea.grab_focus();
    const btn = dragGesture.get_current_button();
    const worldPt = screenToWorld(startX, startY, state.camera);

    // Check item hit
    const hit = hitTestItem(items, worldPt.x, worldPt.y);
    if (hit) {
      onItemPress?.(hit.id);
      return;
    }

    if (btn === 2) {
      // Middle button => pan
      state.interaction = 'panning';
      state.panAnchor = { x: startX, y: startY };
      state.panCameraAnchor = { x: state.camera.x, y: state.camera.y };
    } else {
      // Left button on empty => marquee selection
      state.interaction = 'selecting';
      state.marqueeStart = worldPt;
      state.marqueeEnd = worldPt;
    }
  });

  dragGesture.connect(
    'drag-update',
    (_gesture: any, offsetX: number, offsetY: number) => {
      if (state.interaction === 'panning' && state.panAnchor && state.panCameraAnchor) {
        const dx = offsetX / state.camera.zoom;
        const dy = offsetY / state.camera.zoom;
        state.camera.x = state.panCameraAnchor.x + dx;
        state.camera.y = state.panCameraAnchor.y + dy;
        onCameraChange?.(state.camera);
        drawingArea.queue_draw();
      } else if (state.interaction === 'selecting' && state.marqueeStart) {
        const anchor = state.panAnchor ?? { x: 0, y: 0 };
        // drag-update gives offset from start, reconstruct absolute position
        const absX = (state.marqueeStart.x + state.camera.x) * state.camera.zoom + offsetX;
        const absY = (state.marqueeStart.y + state.camera.y) * state.camera.zoom + offsetY;
        state.marqueeEnd = screenToWorld(absX, absY, state.camera);
        drawingArea.queue_draw();
      }
    },
  );

  dragGesture.connect('drag-end', () => {
    if (state.interaction === 'panning') {
      state.interaction = 'idle';
      state.panAnchor = null;
      state.panCameraAnchor = null;
      onCameraChange?.(state.camera);
    } else if (state.interaction === 'selecting') {
      if (state.marqueeStart && state.marqueeEnd) {
        const selIds = items
          .filter((item) => marqueeIntersects(item, state.marqueeStart!, state.marqueeEnd!))
          .map((item) => item.id);
        selectedIds = new Set(selIds);
        onSelectionChange?.(selIds);
      }
      state.interaction = 'idle';
      state.marqueeStart = null;
      state.marqueeEnd = null;
      drawingArea.queue_draw();
    }
  });

  drawingArea.add_controller(dragGesture);

  // --- Gesture: zoom (pinch or scroll) ---
  const zoomGesture = new Gtk.GestureZoom();
  let zoomAnchorScale = 1;

  zoomGesture.connect('scale-changed', (_gesture: any, scale: number) => {
    const ratio = scale / zoomAnchorScale;
    zoomAnchorScale = scale;
    const nextZoom = Math.max(zoomMin, Math.min(zoomMax, state.camera.zoom * ratio));
    state.camera.zoom = nextZoom;
    onCameraChange?.(state.camera);
    drawingArea.queue_draw();
  });

  zoomGesture.connect('begin', () => {
    zoomAnchorScale = 1;
  });

  drawingArea.add_controller(zoomGesture);

  // --- Scroll wheel zoom ---
  const scrollController = new Gtk.EventControllerScroll({
    flags: Gtk.EventControllerScrollFlags.VERTICAL,
  });

  scrollController.connect(
    'scroll',
    (_ctrl: any, _dx: number, dy: number) => {
      const factor = dy > 0 ? 0.95 : 1.05;
      const nextZoom = Math.max(zoomMin, Math.min(zoomMax, state.camera.zoom * factor));
      state.camera.zoom = nextZoom;
      onCameraChange?.(state.camera);
      drawingArea.queue_draw();
      return true;
    },
  );

  drawingArea.add_controller(scrollController);

  // --- Keyboard ---
  const keyController = new Gtk.EventControllerKey();

  keyController.connect(
    'key-pressed',
    (_ctrl: any, keyval: number, _keycode: number, modState: number) => {
      const ctrl = (modState & Gdk.ModifierType.CONTROL_MASK) !== 0;

      switch (keyval) {
        case Gdk.KEY_Escape:
          if (state.interaction === 'contextMenu') {
            state.interaction = 'idle';
            drawingArea.queue_draw();
          }
          return true;

        case Gdk.KEY_Delete:
        case Gdk.KEY_BackSpace:
          onDeleteSelected?.();
          return true;

        case Gdk.KEY_a:
          if (ctrl) {
            selectedIds = new Set(items.map((i) => i.id));
            onSelectionChange?.(items.map((i) => i.id));
            drawingArea.queue_draw();
            return true;
          }
          return false;

        case Gdk.KEY_equal:
        case Gdk.KEY_plus:
          if (ctrl) {
            state.camera.zoom = Math.min(zoomMax, state.camera.zoom * 1.1);
            onCameraChange?.(state.camera);
            drawingArea.queue_draw();
            return true;
          }
          return false;

        case Gdk.KEY_minus:
          if (ctrl) {
            state.camera.zoom = Math.max(zoomMin, state.camera.zoom * 0.9);
            onCameraChange?.(state.camera);
            drawingArea.queue_draw();
            return true;
          }
          return false;

        case Gdk.KEY_0:
          if (ctrl) {
            state.camera.zoom = 1;
            onCameraChange?.(state.camera);
            drawingArea.queue_draw();
            return true;
          }
          return false;

        case Gdk.KEY_Up:
          state.camera.y += 10 / state.camera.zoom;
          onCameraChange?.(state.camera);
          drawingArea.queue_draw();
          return true;
        case Gdk.KEY_Down:
          state.camera.y -= 10 / state.camera.zoom;
          onCameraChange?.(state.camera);
          drawingArea.queue_draw();
          return true;
        case Gdk.KEY_Left:
          state.camera.x += 10 / state.camera.zoom;
          onCameraChange?.(state.camera);
          drawingArea.queue_draw();
          return true;
        case Gdk.KEY_Right:
          state.camera.x -= 10 / state.camera.zoom;
          onCameraChange?.(state.camera);
          drawingArea.queue_draw();
          return true;

        default:
          return false;
      }
    },
  );

  drawingArea.add_controller(keyController);

  // --- Right-click (context menu) via GestureClick ---
  const rightClickGesture = new Gtk.GestureClick({ button: 3 });
  rightClickGesture.connect('pressed', (_gesture: any, _n: number, x: number, y: number) => {
    state.interaction = 'contextMenu';
    drawingArea.queue_draw();
  });
  drawingArea.add_controller(rightClickGesture);

  return drawingArea;
}
