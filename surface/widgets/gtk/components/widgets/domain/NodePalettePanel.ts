// ============================================================
// Clef Surface GTK Widget — NodePalettePanel
//
// Draggable palette of node types from a DiagramNotation.
// Users drag items from the palette onto the canvas to create
// new nodes. Uses GtkFlowBox for the type grid and
// GtkSearchEntry for filtering.
//
// Adapts the node-palette-panel.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface NodeTypeEntry {
  type_key: string;
  label: string;
  shape: string;
  default_fill?: string;
  icon?: string;
}

// --------------- Props ---------------

export interface NodePalettePanelProps {
  notationId?: string;
  notationName?: string;
  types?: NodeTypeEntry[];
  orientation?: 'horizontal' | 'vertical';
  searchQuery?: string;
  onDragStart?: (typeKey: string) => void;
}

// --------------- Component ---------------

export function createNodePalettePanel(props: NodePalettePanelProps = {}): Gtk.Widget {
  const {
    notationName = '',
    types = [],
    orientation = 'vertical',
    searchQuery = '',
    onDragStart,
  } = props;

  const isVertical = orientation === 'vertical';
  const root = new Gtk.Box({
    orientation: isVertical ? Gtk.Orientation.VERTICAL : Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  root.get_style_context().add_class('toolbar');

  // Header
  const header = new Gtk.Label({ label: notationName || 'Node Palette', xalign: 0 });
  header.get_style_context().add_class('heading');
  root.append(header);

  // Search filter
  const searchEntry = new Gtk.SearchEntry({ placeholderText: 'Filter types\u2026' });
  if (searchQuery) searchEntry.set_text(searchQuery);
  root.append(searchEntry);

  // Type grid
  const flowBox = new Gtk.FlowBox({
    selectionMode: Gtk.SelectionMode.NONE,
    maxChildrenPerLine: isVertical ? 3 : 100,
    homogeneous: true,
  });
  root.append(flowBox);

  let currentFilter = searchQuery.toLowerCase();

  function populateGrid(filter: string): void {
    // Remove existing children
    let child = flowBox.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      flowBox.remove(child);
      child = next;
    }

    const filtered = types.filter((t) =>
      t.label.toLowerCase().includes(filter),
    );

    filtered.forEach((entry) => {
      const item = new Gtk.Button({ label: entry.label });
      item.set_tooltip_text(`Add ${entry.label} node`);

      // Drag source for DnD onto canvas
      const dragSource = new Gtk.DragSource();
      dragSource.connect('prepare', () => {
        onDragStart?.(entry.type_key);
        return null;
      });
      item.add_controller(dragSource);

      flowBox.append(item);
    });
  }

  populateGrid(currentFilter);

  searchEntry.connect('search-changed', () => {
    currentFilter = searchEntry.get_text().toLowerCase();
    populateGrid(currentFilter);
  });

  // Wrap in a scrolled window for overflow
  const scrolled = new Gtk.ScrolledWindow({
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
  });
  const outer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
  outer.append(header);
  outer.append(searchEntry);
  scrolled.set_child(flowBox);
  outer.append(scrolled);

  return outer;
}
