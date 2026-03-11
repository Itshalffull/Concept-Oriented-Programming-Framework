// ============================================================
// Clef Surface GTK Widget — Splitter
//
// Resizable split pane layout. Uses Gtk.Paned for horizontal
// or vertical resizable two-panel layout with a draggable
// divider.
//
// Adapts the splitter.widget spec: anatomy (root, panel,
// separator), states (idle, dragging), and connect attributes
// to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface SplitterProps {
  orientation?: 'horizontal' | 'vertical';
  position?: number;
  startChild?: Gtk.Widget | null;
  endChild?: Gtk.Widget | null;
  onPositionChange?: (position: number) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Paned widget for resizable split-pane layout
 * with a draggable divider.
 */
export function createSplitter(props: SplitterProps = {}): Gtk.Widget {
  const {
    orientation = 'horizontal',
    position = 200,
    startChild = null,
    endChild = null,
    onPositionChange,
  } = props;

  const paned = new Gtk.Paned({
    orientation: orientation === 'vertical'
      ? Gtk.Orientation.VERTICAL
      : Gtk.Orientation.HORIZONTAL,
    position,
  });

  if (startChild) {
    paned.set_start_child(startChild);
  }
  if (endChild) {
    paned.set_end_child(endChild);
  }

  if (onPositionChange) {
    paned.connect('notify::position', () => {
      onPositionChange(paned.get_position());
    });
  }

  return paned;
}
