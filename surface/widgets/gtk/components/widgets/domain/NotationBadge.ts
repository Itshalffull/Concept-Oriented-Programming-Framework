// ============================================================
// Clef Surface GTK Widget — NotationBadge
//
// Small clickable badge displaying the active diagram notation
// on a canvas toolbar. Shows notation name with a tooltip
// containing the notation description. Clicking opens a
// notation selector.
//
// Adapts the notation-badge.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface NotationBadgeProps {
  notationId?: string;
  notationName?: string;
  notationIcon?: string;
  canvasId?: string;
  onClick?: () => void;
}

// --------------- Component ---------------

export function createNotationBadge(props: NotationBadgeProps = {}): Gtk.Widget {
  const {
    notationName,
    notationIcon,
    onClick,
  } = props;

  const displayName = notationName || 'Freeform';

  const button = new Gtk.Button();
  button.get_style_context().add_class('flat');

  const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });

  // Icon (if provided, show as label placeholder since GTK icon handling varies)
  if (notationIcon) {
    const icon = new Gtk.Image({ iconName: notationIcon });
    box.append(icon);
  }

  // Name label
  const label = new Gtk.Label({ label: displayName });
  label.get_style_context().add_class('caption');
  box.append(label);

  button.set_child(box);
  button.set_tooltip_text(`Notation: ${displayName}`);

  button.connect('clicked', () => {
    onClick?.();
  });

  return button;
}
