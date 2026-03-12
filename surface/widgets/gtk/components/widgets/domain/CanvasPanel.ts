// ============================================================
// Clef Surface GTK Widget — CanvasPanel
//
// Generic collapsible panel for docking alongside a canvas.
// Provides a header with title and collapse toggle, optional
// tabbed navigation via GtkStack + GtkStackSwitcher, and a
// scrollable body area for arbitrary content.
//
// Adapts the canvas-panel.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export type PanelDock = 'left' | 'right';
export type PanelState = 'expanded' | 'collapsed' | 'minimized';

export interface PanelTab {
  id: string;
  label: string;
}

// --------------- Props ---------------

export interface CanvasPanelProps {
  canvasId?: string;
  title?: string;
  dock?: PanelDock;
  defaultWidth?: number;
  collapsible?: boolean;
  initialState?: PanelState;
  tabs?: PanelTab[];
  activeTab?: string;
  content?: Gtk.Widget;
  onCollapse?: () => void;
  onExpand?: () => void;
  onTabChange?: (tabId: string) => void;
}

// --------------- Component ---------------

export function createCanvasPanel(props: CanvasPanelProps = {}): Gtk.Widget {
  const {
    title = 'Panel',
    defaultWidth = 320,
    collapsible = true,
    initialState = 'expanded',
    tabs = [],
    activeTab,
    content,
    onCollapse,
    onExpand,
    onTabChange,
  } = props;

  let expanded = initialState === 'expanded';

  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 0,
    widthRequest: expanded ? defaultWidth : -1,
  });
  root.get_style_context().add_class('canvas-panel');

  // Header row: title + collapse toggle
  const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
  header.set_margin_top(8);
  header.set_margin_bottom(4);
  header.set_margin_start(12);
  header.set_margin_end(8);

  const titleLabel = new Gtk.Label({ label: title, xalign: 0, hexpand: true });
  titleLabel.get_style_context().add_class('heading');
  header.append(titleLabel);

  const collapseBtn = new Gtk.Button({ label: expanded ? '\u25C0' : '\u25B6' });
  collapseBtn.get_style_context().add_class('flat');
  collapseBtn.set_tooltip_text(expanded ? 'Collapse' : 'Expand');
  if (!collapsible) collapseBtn.set_visible(false);
  header.append(collapseBtn);

  root.append(header);

  // Separator between header and body
  const separator = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL });
  root.append(separator);

  // Body container (hidden when collapsed)
  const body = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0, vexpand: true });

  // Tabs (optional)
  let tabStack: Gtk.Stack | null = null;

  if (tabs.length > 0) {
    tabStack = new Gtk.Stack({
      transitionType: Gtk.StackTransitionType.CROSSFADE,
      transitionDuration: 150,
    });

    const switcher = new Gtk.StackSwitcher({ stack: tabStack });
    switcher.set_margin_top(4);
    switcher.set_margin_bottom(4);
    switcher.set_margin_start(8);
    switcher.set_margin_end(8);
    body.append(switcher);

    const tabSeparator = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL });
    body.append(tabSeparator);

    tabs.forEach((tab) => {
      const tabBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0, vexpand: true });
      const placeholder = new Gtk.Label({ label: tab.label, valign: Gtk.Align.CENTER, vexpand: true });
      placeholder.get_style_context().add_class('dim-label');
      tabBox.append(placeholder);
      tabStack!.add_titled(tabBox, tab.id, tab.label);
    });

    // Pre-select active tab
    if (activeTab) {
      tabStack.set_visible_child_name(activeTab);
    }

    // Notify on tab change
    tabStack.connect('notify::visible-child-name', () => {
      const name = tabStack!.get_visible_child_name();
      if (name) onTabChange?.(name);
    });

    body.append(tabStack);
  }

  // Scrollable content area
  const scrolled = new Gtk.ScrolledWindow({
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
    vexpand: true,
  });

  if (content) {
    scrolled.set_child(content);
  } else if (tabs.length === 0) {
    // Empty state when no tabs and no content
    const emptyLabel = new Gtk.Label({ label: 'No content', valign: Gtk.Align.CENTER, vexpand: true });
    emptyLabel.get_style_context().add_class('dim-label');
    scrolled.set_child(emptyLabel);
  }

  // Only show scrolled content when there are no tabs (tabs provide their own content)
  if (tabs.length === 0) {
    body.append(scrolled);
  }

  root.append(body);

  // Initial visibility
  body.set_visible(expanded);

  // Collapse toggle logic
  collapseBtn.connect('clicked', () => {
    expanded = !expanded;
    body.set_visible(expanded);
    collapseBtn.set_label(expanded ? '\u25C0' : '\u25B6');
    collapseBtn.set_tooltip_text(expanded ? 'Collapse' : 'Expand');
    root.set_size_request(expanded ? defaultWidth : -1, -1);

    if (expanded) {
      onExpand?.();
    } else {
      onCollapse?.();
    }
  });

  return root;
}
