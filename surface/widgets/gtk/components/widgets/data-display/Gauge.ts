// ============================================================
// Clef Surface GTK Widget — Gauge
//
// Circular or semicircular progress gauge. Uses Gtk.DrawingArea
// for custom arc rendering with a value label in the center.
//
// Adapts the gauge.widget spec: anatomy (root, track, range,
// label, valueText), states (idle), and connect attributes
// to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface GaugeProps {
  value?: number;
  min?: number;
  max?: number;
  label?: string | null;
  size?: number;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 gauge widget using Gtk.DrawingArea for
 * custom arc-based progress display.
 */
export function createGauge(props: GaugeProps = {}): Gtk.Widget {
  const {
    value = 0,
    min = 0,
    max = 100,
    label = null,
    size = 120,
  } = props;

  const fraction = max > min ? (value - min) / (max - min) : 0;
  const percent = Math.round(fraction * 100);

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
    halign: Gtk.Align.CENTER,
  });

  const drawingArea = new Gtk.DrawingArea({
    widthRequest: size,
    heightRequest: size,
  });

  drawingArea.set_draw_func((_area: Gtk.DrawingArea, cr: any, w: number, h: number) => {
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 8;
    const lineWidth = 8;

    // Track
    cr.setLineWidth(lineWidth);
    cr.setSourceRGBA(0.8, 0.8, 0.8, 1);
    cr.arc(cx, cy, radius, -Math.PI * 0.75, Math.PI * 0.75);
    cr.stroke();

    // Value arc
    const startAngle = -Math.PI * 0.75;
    const endAngle = startAngle + fraction * Math.PI * 1.5;
    cr.setSourceRGBA(0.2, 0.5, 0.9, 1);
    cr.arc(cx, cy, radius, startAngle, endAngle);
    cr.stroke();

    // Center text
    cr.setSourceRGBA(0, 0, 0, 1);
    cr.setFontSize(16);
    const text = `${percent}%`;
    const extents = cr.textExtents(text);
    cr.moveTo(cx - extents.width / 2, cy + extents.height / 2);
    cr.showText(text);
  });

  container.append(drawingArea);

  if (label) {
    const labelWidget = new Gtk.Label({ label });
    labelWidget.get_style_context().add_class('dim-label');
    container.append(labelWidget);
  }

  return container;
}
