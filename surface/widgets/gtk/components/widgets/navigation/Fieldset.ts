// ============================================================
// Clef Surface GTK Widget — Fieldset
//
// Grouped form fields with a legend label. Uses Gtk.Frame
// with a label widget to group related form controls.
//
// Adapts the fieldset.widget spec: anatomy (root, legend,
// content), states (idle, disabled), and connect attributes
// to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface FieldsetProps {
  legend?: string;
  disabled?: boolean;
  content?: Gtk.Widget | null;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Frame widget for grouping related form
 * controls under a legend label.
 */
export function createFieldset(props: FieldsetProps = {}): Gtk.Widget {
  const {
    legend = '',
    disabled = false,
    content = null,
  } = props;

  const frame = new Gtk.Frame({
    label: legend,
  });

  if (content) {
    frame.set_child(content);
  }

  frame.set_sensitive(!disabled);

  return frame;
}
