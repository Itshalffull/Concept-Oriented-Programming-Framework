// ============================================================
// Clef Surface GTK Widget — ProgressBar
//
// Determinate or indeterminate progress indicator. Uses
// Gtk.ProgressBar with fraction-based progress and optional
// label text display.
//
// Adapts the progress-bar.widget spec: anatomy (root, track,
// range, label), states (determinate, indeterminate), and
// connect attributes (data-value, data-max, data-state)
// to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface ProgressBarProps {
  value?: number;
  max?: number;
  indeterminate?: boolean;
  label?: string | null;
  showText?: boolean;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 ProgressBar with determinate fraction-based
 * or indeterminate pulsing progress display.
 */
export function createProgressBar(props: ProgressBarProps = {}): Gtk.Widget {
  const {
    value = 0,
    max = 100,
    indeterminate = false,
    label = null,
    showText = true,
  } = props;

  const fraction = max > 0 ? Math.min(value / max, 1) : 0;
  const percent = Math.round(fraction * 100);

  const progressBar = new Gtk.ProgressBar({
    fraction: indeterminate ? 0 : fraction,
    showText: showText && !indeterminate,
    text: showText ? `${percent}%` : undefined,
  });

  if (indeterminate) {
    progressBar.pulse();
  }

  if (label) {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 4,
    });
    box.append(new Gtk.Label({ label, xalign: 0 }));
    box.append(progressBar);
    return box;
  }

  return progressBar;
}
