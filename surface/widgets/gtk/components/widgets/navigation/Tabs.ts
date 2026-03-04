// ============================================================
// Clef Surface GTK Widget — Tabs
//
// Tabbed content switcher. Uses Gtk.Notebook or Adw.ViewStack
// with Adw.ViewSwitcher for tab-based content switching.
//
// Adapts the tabs.widget spec: anatomy (root, list, trigger,
// content, indicator) to GTK4 rendering.
// See Architecture doc Section 16.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface TabsProps {
  tabs?: TabItem[];
  activeId?: string | null;
  onChange?: (id: string) => void;
  content?: Gtk.Widget | null;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 tabbed content switcher using Gtk.Notebook
 * for tab-based navigation and content switching.
 */
export function createTabs(props: TabsProps = {}): Gtk.Widget {
  const {
    tabs = [],
    activeId = null,
    onChange,
    content = null,
  } = props;

  const notebook = new Gtk.Notebook();

  tabs.forEach((tab) => {
    const page = content && tab.id === activeId
      ? content
      : new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });

    const tabLabel = new Gtk.Label({ label: tab.label });
    if (tab.disabled) {
      tabLabel.set_sensitive(false);
    }

    notebook.append_page(page, tabLabel);
  });

  // Set active tab
  const activeIdx = tabs.findIndex((t) => t.id === activeId);
  if (activeIdx >= 0) {
    notebook.set_current_page(activeIdx);
  }

  notebook.connect('switch-page', (_nb: Gtk.Notebook, _page: Gtk.Widget, pageNum: number) => {
    if (pageNum >= 0 && pageNum < tabs.length) {
      onChange?.(tabs[pageNum].id);
    }
  });

  return notebook;
}
