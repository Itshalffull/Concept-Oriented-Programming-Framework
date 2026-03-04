// ============================================================
// Clef Surface GTK Widget — NavigationMenu
//
// Hierarchical navigation menu. Renders as a vertical Gtk.ListBox
// with expandable sections for nested navigation items.
//
// Adapts the navigation-menu.widget spec: anatomy (root, list,
// item, trigger, content, link, indicator), states (idle,
// expanded), and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface NavigationMenuItem {
  id: string;
  label: string;
  children?: NavigationMenuItem[];
  disabled?: boolean;
}

// --------------- Props ---------------

export interface NavigationMenuProps {
  items?: NavigationMenuItem[];
  activeId?: string | null;
  onNavigate?: (id: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 navigation menu as a vertical ListBox with
 * expandable sections for hierarchical navigation.
 */
export function createNavigationMenu(props: NavigationMenuProps = {}): Gtk.Widget {
  const {
    items = [],
    activeId = null,
    onNavigate,
  } = props;

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 0,
  });

  function buildLevel(menuItems: NavigationMenuItem[], depth: number): void {
    menuItems.forEach((item) => {
      if (item.children && item.children.length > 0) {
        const expander = new Gtk.Expander({ label: item.label });
        const childBox = new Gtk.Box({
          orientation: Gtk.Orientation.VERTICAL,
          spacing: 0,
          marginStart: 16,
        });
        item.children.forEach((child) => {
          const btn = new Gtk.Button({ label: child.label });
          btn.get_style_context().add_class('flat');
          if (child.id === activeId) {
            btn.get_style_context().add_class('accent');
          }
          btn.set_sensitive(!child.disabled);
          btn.connect('clicked', () => onNavigate?.(child.id));
          childBox.append(btn);
        });
        expander.set_child(childBox);
        box.append(expander);
      } else {
        const btn = new Gtk.Button({ label: item.label });
        btn.get_style_context().add_class('flat');
        if (item.id === activeId) {
          btn.get_style_context().add_class('accent');
        }
        btn.set_sensitive(!item.disabled);
        btn.connect('clicked', () => onNavigate?.(item.id));
        box.append(btn);
      }
    });
  }

  buildLevel(items, 0);
  return box;
}
