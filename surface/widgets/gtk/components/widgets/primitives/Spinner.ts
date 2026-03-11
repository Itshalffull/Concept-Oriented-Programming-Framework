// ============================================================
// Clef Surface GTK Widget — Spinner
//
// Indeterminate loading indicator rendered with Gtk.Spinner.
// An optional label is displayed alongside the spinner. Size
// affects the spinner dimensions.
//
// Adapts the spinner.widget spec: anatomy (root, track,
// indicator, label), states (spinning), and connect attributes
// (data-part, data-size, role, aria-busy, aria-label)
// to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Helpers ---------------

function sizeToPixels(size: string): number {
  switch (size) {
    case 'sm': return 16;
    case 'lg': return 48;
    default: return 24; // md
  }
}

// --------------- Props ---------------

export interface SpinnerProps {
  size?: string;
  label?: string | null;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Spinner widget with an optional text label
 * displayed alongside.
 */
export function createSpinner(props: SpinnerProps = {}): Gtk.Widget {
  const { size = 'md', label = null } = props;
  const pixels = sizeToPixels(size);

  const spinner = new Gtk.Spinner({
    spinning: true,
    widthRequest: pixels,
    heightRequest: pixels,
  });

  if (label) {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 8,
    });
    box.append(spinner);
    box.append(new Gtk.Label({ label }));
    return box;
  }

  return spinner;
}
