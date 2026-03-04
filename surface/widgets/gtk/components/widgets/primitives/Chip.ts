// ============================================================
// Clef Surface GTK Widget — Chip
//
// Compact interactive tag element rendered as a GTK4 Box with
// a label and optional close button. Supports filled and
// outline variants, selection toggle, and dismiss action.
//
// Adapts the chip.widget spec: anatomy (root, label,
// deleteButton, icon), states (idle, selected, hovered, focused,
// removed, deletable, disabled), and connect attributes
// (data-part, data-state, data-disabled) to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface ChipProps {
  label?: string;
  variant?: 'filled' | 'outline';
  selected?: boolean;
  disabled?: boolean;
  removable?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 chip widget as a compact tag with optional
 * selection and dismiss behaviour.
 */
export function createChip(props: ChipProps = {}): Gtk.Widget {
  const {
    label = '',
    variant = 'filled',
    selected = false,
    disabled = false,
    removable = false,
    onSelect,
    onRemove,
  } = props;

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 4,
  });

  const ctx = box.get_style_context();
  ctx.add_class('chip');
  if (variant === 'outline') {
    ctx.add_class('chip-outline');
  }
  if (selected) {
    ctx.add_class('chip-selected');
  }

  const labelWidget = new Gtk.Label({ label });
  box.append(labelWidget);

  if (removable) {
    const closeButton = new Gtk.Button({
      iconName: 'window-close-symbolic',
    });
    closeButton.get_style_context().add_class('flat');
    closeButton.get_style_context().add_class('circular');
    closeButton.set_sensitive(!disabled);
    if (onRemove) {
      closeButton.connect('clicked', onRemove);
    }
    box.append(closeButton);
  }

  if (onSelect) {
    const gesture = new Gtk.GestureClick();
    gesture.connect('released', () => {
      if (!disabled) onSelect();
    });
    box.add_controller(gesture);
  }

  box.set_sensitive(!disabled);
  return box;
}
