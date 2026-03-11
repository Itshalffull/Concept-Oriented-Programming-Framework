// ============================================================
// Clef Surface GTK Widget — CanvasConnector
//
// Visual connection line between canvas nodes. Renders as a
// DrawingArea segment connecting two endpoint positions.
//
// Adapts the canvas-connector.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface CanvasConnectorProps {
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  label?: string | null;
  color?: string;
}

// --------------- Component ---------------

export function createCanvasConnector(props: CanvasConnectorProps = {}): Gtk.Widget {
  const { fromX = 0, fromY = 0, toX = 100, toY = 100, label = null } = props;

  const w = Math.abs(toX - fromX) + 20;
  const h = Math.abs(toY - fromY) + 20;

  const drawingArea = new Gtk.DrawingArea({ widthRequest: w, heightRequest: h });

  drawingArea.set_draw_func((_area: Gtk.DrawingArea, cr: any) => {
    cr.setSourceRGBA(0.4, 0.4, 0.4, 1);
    cr.setLineWidth(2);
    cr.moveTo(10, 10);
    cr.lineTo(w - 10, h - 10);
    cr.stroke();

    // Arrow head
    cr.moveTo(w - 10, h - 10);
    cr.lineTo(w - 18, h - 6);
    cr.moveTo(w - 10, h - 10);
    cr.lineTo(w - 6, h - 18);
    cr.stroke();

    if (label) {
      cr.setFontSize(10);
      cr.moveTo(w / 2 - 10, h / 2);
      cr.showText(label);
    }
  });

  return drawingArea;
}
