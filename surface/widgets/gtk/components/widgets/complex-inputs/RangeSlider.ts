// ============================================================
// Clef Surface GTK Widget — RangeSlider
//
// Dual-thumb range slider for selecting a value range. Uses
// two Gtk.Scale widgets or a custom Gtk.DrawingArea for
// min/max range selection.
//
// Adapts the range-slider.widget spec: anatomy (root, track,
// range, thumbMin, thumbMax, output), states (idle, dragging),
// and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface RangeSliderProps {
  minValue?: number;
  maxValue?: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string | null;
  disabled?: boolean;
  onRangeChange?: (min: number, max: number) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 range slider with two scale widgets for
 * min/max range selection.
 */
export function createRangeSlider(props: RangeSliderProps = {}): Gtk.Widget {
  const {
    minValue = 0,
    maxValue = 100,
    min = 0,
    max = 100,
    step = 1,
    label = null,
    disabled = false,
    onRangeChange,
  } = props;

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });

  if (label) {
    container.append(new Gtk.Label({ label, xalign: 0 }));
  }

  // Min slider
  const minAdj = new Gtk.Adjustment({
    value: minValue,
    lower: min,
    upper: max,
    stepIncrement: step,
    pageIncrement: step * 10,
    pageSize: 0,
  });
  const minScale = new Gtk.Scale({
    orientation: Gtk.Orientation.HORIZONTAL,
    adjustment: minAdj,
    drawValue: true,
    hexpand: true,
  });
  minScale.set_sensitive(!disabled);

  // Max slider
  const maxAdj = new Gtk.Adjustment({
    value: maxValue,
    lower: min,
    upper: max,
    stepIncrement: step,
    pageIncrement: step * 10,
    pageSize: 0,
  });
  const maxScale = new Gtk.Scale({
    orientation: Gtk.Orientation.HORIZONTAL,
    adjustment: maxAdj,
    drawValue: true,
    hexpand: true,
  });
  maxScale.set_sensitive(!disabled);

  minScale.connect('value-changed', () => {
    const v = minScale.get_value();
    if (v > maxScale.get_value()) {
      maxScale.set_value(v);
    }
    onRangeChange?.(v, maxScale.get_value());
  });

  maxScale.connect('value-changed', () => {
    const v = maxScale.get_value();
    if (v < minScale.get_value()) {
      minScale.set_value(v);
    }
    onRangeChange?.(minScale.get_value(), v);
  });

  container.append(new Gtk.Label({ label: 'Min', xalign: 0 }));
  container.append(minScale);
  container.append(new Gtk.Label({ label: 'Max', xalign: 0 }));
  container.append(maxScale);

  return container;
}
