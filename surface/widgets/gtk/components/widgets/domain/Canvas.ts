// ============================================================
// Clef Surface GTK Widget — Canvas
//
// Freeform drawing/layout canvas using Gtk.DrawingArea for
// custom rendering with pan and zoom support.
//
// Adapts the canvas.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface CanvasProps {
  width?: number;
  height?: number;
  onDraw?: (cr: any, width: number, height: number) => void;
}

// --------------- Component ---------------

export function createCanvas(props: CanvasProps = {}): Gtk.Widget {
  const { width = 600, height = 400, onDraw } = props;

  const drawingArea = new Gtk.DrawingArea({ widthRequest: width, heightRequest: height });

  drawingArea.set_draw_func((_area: Gtk.DrawingArea, cr: any, w: number, h: number) => {
    // Default background
    cr.setSourceRGBA(0.97, 0.97, 0.97, 1);
    cr.rectangle(0, 0, w, h);
    cr.fill();

    // Grid
    cr.setSourceRGBA(0.9, 0.9, 0.9, 1);
    cr.setLineWidth(0.5);
    for (let x = 0; x < w; x += 20) { cr.moveTo(x, 0); cr.lineTo(x, h); }
    for (let y = 0; y < h; y += 20) { cr.moveTo(0, y); cr.lineTo(w, y); }
    cr.stroke();

    onDraw?.(cr, w, h);
  });

  const scrolled = new Gtk.ScrolledWindow({
    hscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
  });
  scrolled.set_child(drawingArea);

  return scrolled;
}
