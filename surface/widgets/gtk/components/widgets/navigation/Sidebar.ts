// ============================================================
// Clef Surface GTK Widget — Sidebar
//
// Vertical navigation sidebar with sections and items. Uses
// Gtk.StackSidebar-style layout or a custom Gtk.ListBox for
// sidebar navigation items.
//
// Adapts the sidebar.widget spec: anatomy (root, header, nav,
// section, item, footer), states (expanded, collapsed), and
// connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface SidebarItem {
  id: string;
  label: string;
  iconName?: string;
  disabled?: boolean;
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

// --------------- Props ---------------

export interface SidebarProps {
  sections?: SidebarSection[];
  activeId?: string | null;
  onNavigate?: (id: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 sidebar navigation with sections and items
 * as a vertical ListBox.
 */
export function createSidebar(props: SidebarProps = {}): Gtk.Widget {
  const {
    sections = [],
    activeId = null,
    onNavigate,
  } = props;

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
    widthRequest: 220,
  });
  box.get_style_context().add_class('navigation-sidebar');

  sections.forEach((section) => {
    if (section.title) {
      const sectionLabel = new Gtk.Label({
        label: section.title,
        xalign: 0,
      });
      sectionLabel.get_style_context().add_class('heading');
      box.append(sectionLabel);
    }

    const listBox = new Gtk.ListBox({
      selectionMode: Gtk.SelectionMode.SINGLE,
    });
    listBox.get_style_context().add_class('navigation-sidebar');

    section.items.forEach((item) => {
      const row = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 8,
      });

      if (item.iconName) {
        row.append(new Gtk.Image({ iconName: item.iconName, pixelSize: 16 }));
      }
      row.append(new Gtk.Label({ label: item.label, xalign: 0, hexpand: true }));

      const listRow = new Gtk.ListBoxRow();
      listRow.set_child(row);
      listRow.set_sensitive(!item.disabled);
      (listRow as any)._navId = item.id;

      if (item.id === activeId) {
        listBox.select_row(listRow);
      }

      listBox.append(listRow);
    });

    listBox.connect('row-activated', (_listBox: Gtk.ListBox, row: Gtk.ListBoxRow) => {
      const id = (row as any)._navId;
      if (id) onNavigate?.(id);
    });

    box.append(listBox);
  });

  return box;
}
