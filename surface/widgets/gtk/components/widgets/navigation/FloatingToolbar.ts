// ============================================================
// Clef Surface GTK Widget — FloatingToolbar
//
// Contextual toolbar that floats near the selection or focus
// point. Renders as a Gtk.Box with action buttons inside a
// Gtk.Popover or overlay positioning.
//
// Adapts the floating-toolbar.widget spec: anatomy (root,
// items, item, separator), states (visible, hidden), and
// connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface FloatingToolbarItem {
  id: string;
  label: string;
  iconName?: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface FloatingToolbarProps {
  items?: FloatingToolbarItem[];
  visible?: boolean;
  onAction?: (id: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 floating toolbar as a horizontal box of action
 * buttons with connected styling.
 */
export function createFloatingToolbar(props: FloatingToolbarProps = {}): Gtk.Widget {
  const {
    items = [],
    visible = true,
    onAction,
  } = props;

  const revealer = new Gtk.Revealer({
    revealChild: visible,
    transitionType: Gtk.RevealerTransitionType.CROSSFADE,
    transitionDuration: 150,
  });

  const toolbar = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 0,
  });
  toolbar.get_style_context().add_class('linked');
  toolbar.get_style_context().add_class('toolbar');

  items.forEach((item) => {
    const button = item.iconName
      ? new Gtk.Button({ iconName: item.iconName, tooltipText: item.label })
      : new Gtk.Button({ label: item.label });

    button.set_sensitive(!item.disabled);
    button.connect('clicked', () => onAction?.(item.id));
    toolbar.append(button);
  });

  revealer.set_child(toolbar);
  return revealer;
}
