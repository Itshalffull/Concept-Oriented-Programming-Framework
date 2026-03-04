// ============================================================
// Clef Surface GTK Widget — CanvasNode
//
// Individual node on a canvas. Renders as a styled card box
// with title, type indicator, and port connectors.
//
// Adapts the canvas-node.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface CanvasNodeProps {
  id?: string;
  label?: string;
  type?: string;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

// --------------- Component ---------------

export function createCanvasNode(props: CanvasNodeProps = {}): Gtk.Widget {
  const { id = '', label = '', type = 'default', selected = false, onSelect } = props;

  const card = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4, widthRequest: 120 });
  card.get_style_context().add_class('card');
  if (selected) card.get_style_context().add_class('accent');

  const typeLabel = new Gtk.Label({ label: `[${type}]`, xalign: 0 });
  typeLabel.get_style_context().add_class('dim-label');
  card.append(typeLabel);

  card.append(new Gtk.Label({ label, xalign: 0 }));

  const gesture = new Gtk.GestureClick();
  gesture.connect('released', () => onSelect?.(id));
  card.add_controller(gesture);

  return card;
}
