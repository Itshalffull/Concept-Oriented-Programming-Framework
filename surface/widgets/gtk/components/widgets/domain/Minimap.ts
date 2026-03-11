// ============================================================
// Clef Surface GTK Widget — Minimap
//
// Miniature overview map of a larger canvas or document.
// Uses Gtk.DrawingArea to render a scaled-down view.
//
// Adapts the minimap.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface MinimapProps {
  width?: number;
  height?: number;
  viewportX?: number;
  viewportY?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  totalWidth?: number;
  totalHeight?: number;
  onViewportChange?: (x: number, y: number) => void;
}

// --------------- Component ---------------

export function createMinimap(props: MinimapProps = {}): Gtk.Widget {
  const {
    width = 150, height = 100,
    viewportX = 0, viewportY = 0,
    viewportWidth = 50, viewportHeight = 30,
    totalWidth = 200, totalHeight = 150,
    onViewportChange,
  } = props;

  const drawingArea = new Gtk.DrawingArea({ widthRequest: width, heightRequest: height });

  drawingArea.set_draw_func((_area: Gtk.DrawingArea, cr: any, w: number, h: number) => {
    // Background
    cr.setSourceRGBA(0.9, 0.9, 0.9, 1);
    cr.rectangle(0, 0, w, h);
    cr.fill();

    // Viewport indicator
    const scaleX = w / totalWidth;
    const scaleY = h / totalHeight;
    cr.setSourceRGBA(0.2, 0.5, 0.9, 0.3);
    cr.rectangle(viewportX * scaleX, viewportY * scaleY, viewportWidth * scaleX, viewportHeight * scaleY);
    cr.fill();
    cr.setSourceRGBA(0.2, 0.5, 0.9, 1);
    cr.rectangle(viewportX * scaleX, viewportY * scaleY, viewportWidth * scaleX, viewportHeight * scaleY);
    cr.stroke();
  });

  if (onViewportChange) {
    const gesture = new Gtk.GestureClick();
    gesture.connect('released', (_g: Gtk.GestureClick, _n: number, x: number, y: number) => {
      const newX = (x / width) * totalWidth;
      const newY = (y / height) * totalHeight;
      onViewportChange(newX, newY);
    });
    drawingArea.add_controller(gesture);
  }

  return drawingArea;
}
