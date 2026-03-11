// ============================================================
// Clef Surface GTK Widget — Toolbar
//
// Horizontal toolbar with action buttons and optional
// separators. Uses Gtk.Box with Gtk.Button children and
// connected styling.
//
// Adapts the toolbar.widget spec: anatomy (root, group, item,
// separator), states (idle), and connect attributes to GTK4
// rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface ToolbarItem {
  id: string;
  label?: string;
  iconName?: string;
  disabled?: boolean;
  separator?: boolean;
}

// --------------- Props ---------------

export interface ToolbarProps {
  items?: ToolbarItem[];
  onAction?: (id: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 toolbar as a horizontal box of action buttons
 * with optional separator items.
 */
export function createToolbar(props: ToolbarProps = {}): Gtk.Widget {
  const { items = [], onAction } = props;

  const toolbar = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 4,
  });
  toolbar.get_style_context().add_class('toolbar');

  items.forEach((item) => {
    if (item.separator) {
      toolbar.append(new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL }));
      return;
    }

    const button = item.iconName
      ? new Gtk.Button({ iconName: item.iconName, tooltipText: item.label })
      : new Gtk.Button({ label: item.label ?? '' });

    button.get_style_context().add_class('flat');
    button.set_sensitive(!item.disabled);
    button.connect('clicked', () => onAction?.(item.id));
    toolbar.append(button);
  });

  return toolbar;
}
