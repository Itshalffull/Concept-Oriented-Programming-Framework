// ============================================================
// Clef Surface GTK Widget — Slider
//
// Range input slider. Renders a Gtk.Scale with an optional
// label and value readout. Dragging adjusts the value within
// min/max bounds.
//
// Adapts the slider.widget spec: anatomy (root, label, track,
// range, thumb, output) to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface SliderProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string | null;
  disabled?: boolean;
  showValue?: boolean;
  onValueChange?: (value: number) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Scale widget for range input with optional
 * label and value display.
 */
export function createSlider(props: SliderProps = {}): Gtk.Widget {
  const {
    value = 0,
    min = 0,
    max = 100,
    step = 1,
    label = null,
    disabled = false,
    showValue = true,
    onValueChange,
  } = props;

  const adjustment = new Gtk.Adjustment({
    value,
    lower: min,
    upper: max,
    stepIncrement: step,
    pageIncrement: step * 10,
    pageSize: 0,
  });

  const scale = new Gtk.Scale({
    orientation: Gtk.Orientation.HORIZONTAL,
    adjustment,
    drawValue: showValue,
    hexpand: true,
  });

  scale.set_sensitive(!disabled);

  if (onValueChange) {
    scale.connect('value-changed', () => {
      onValueChange(scale.get_value());
    });
  }

  if (label) {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 4,
    });
    box.append(new Gtk.Label({ label, xalign: 0 }));
    box.append(scale);
    return box;
  }

  return scale;
}
