// ============================================================
// Clef Surface GTK Widget — Breadcrumb
//
// Navigation trail showing the current location within a
// hierarchy. Renders as a horizontal row of linked Gtk.Button
// widgets with separator arrows between them.
//
// Adapts the breadcrumb.widget spec: anatomy (root, list, item,
// link, separator), states (idle, current), and connect
// attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// --------------- Props ---------------

export interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  separator?: string;
  onNavigate?: (index: number) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 breadcrumb navigation trail as a horizontal
 * row of clickable labels with separator arrows.
 */
export function createBreadcrumb(props: BreadcrumbProps = {}): Gtk.Widget {
  const {
    items = [],
    separator = '\u203A',
    onNavigate,
  } = props;

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 4,
  });

  items.forEach((item, index) => {
    const isCurrent = index === items.length - 1;

    if (isCurrent) {
      const label = new Gtk.Label({ label: item.label });
      label.get_style_context().add_class('dim-label');
      box.append(label);
    } else {
      const button = new Gtk.Button({ label: item.label });
      button.get_style_context().add_class('flat');
      button.connect('clicked', () => onNavigate?.(index));
      box.append(button);

      box.append(new Gtk.Label({ label: separator }));
    }
  });

  return box;
}
