// ============================================================
// Clef Surface GTK Widget — CanvasPropertiesPanel
//
// Right sidebar panel showing properties of the selected
// canvas element. Uses GtkStack to switch between item
// properties, connector properties, canvas-level properties,
// and an empty state. Each section uses GtkListBox for form
// rows.
//
// Adapts the canvas-properties-panel.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export type SelectionType = 'none' | 'item' | 'connector' | 'canvas';

export interface PropertyField {
  key: string;
  label: string;
  value: string;
}

// --------------- Props ---------------

export interface CanvasPropertiesPanelProps {
  canvasId?: string;
  selectionType?: SelectionType;
  selectedItemId?: string;
  selectedConnectorId?: string;
  itemProperties?: PropertyField[];
  connectorProperties?: PropertyField[];
  canvasProperties?: PropertyField[];
  onPropertyChange?: (key: string, value: string) => void;
}

// --------------- Helpers ---------------

function buildPropertyForm(
  fields: PropertyField[],
  onChange?: (key: string, value: string) => void,
): Gtk.Widget {
  const listBox = new Gtk.ListBox({ selectionMode: Gtk.SelectionMode.NONE });
  listBox.get_style_context().add_class('boxed-list');

  fields.forEach((field) => {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    row.set_margin_top(4);
    row.set_margin_bottom(4);
    row.set_margin_start(8);
    row.set_margin_end(8);

    const label = new Gtk.Label({ label: field.label, xalign: 0, hexpand: true });
    label.get_style_context().add_class('dim-label');
    row.append(label);

    const entry = new Gtk.Entry({ text: field.value, widthChars: 14 });
    entry.connect('changed', () => {
      onChange?.(field.key, entry.get_text());
    });
    row.append(entry);

    listBox.append(row);
  });

  return listBox;
}

// --------------- Component ---------------

export function createCanvasPropertiesPanel(props: CanvasPropertiesPanelProps = {}): Gtk.Widget {
  const {
    selectionType = 'none',
    itemProperties = [],
    connectorProperties = [],
    canvasProperties = [],
    onPropertyChange,
  } = props;

  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0, widthRequest: 260 });

  // Header
  const header = new Gtk.Label({ label: 'Properties', xalign: 0 });
  header.get_style_context().add_class('heading');
  header.set_margin_top(8);
  header.set_margin_start(12);
  header.set_margin_bottom(8);
  root.append(header);

  // Stack for switching between property forms
  const stack = new Gtk.Stack({
    transitionType: Gtk.StackTransitionType.CROSSFADE,
    transitionDuration: 150,
  });

  // Empty state
  const emptyBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8, valign: Gtk.Align.CENTER, vexpand: true });
  const emptyLabel = new Gtk.Label({ label: 'Nothing selected' });
  emptyLabel.get_style_context().add_class('dim-label');
  emptyBox.append(emptyLabel);
  stack.add_named(emptyBox, 'none');

  // Item properties
  const itemSection = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  const itemTitle = new Gtk.Label({ label: 'Item Properties', xalign: 0 });
  itemTitle.set_margin_start(12);
  itemTitle.get_style_context().add_class('dim-label');
  itemSection.append(itemTitle);
  const itemScrolled = new Gtk.ScrolledWindow({
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
    vexpand: true,
  });
  itemScrolled.set_child(buildPropertyForm(itemProperties, onPropertyChange));
  itemSection.append(itemScrolled);
  stack.add_named(itemSection, 'item');

  // Connector properties
  const connSection = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  const connTitle = new Gtk.Label({ label: 'Connector Properties', xalign: 0 });
  connTitle.set_margin_start(12);
  connTitle.get_style_context().add_class('dim-label');
  connSection.append(connTitle);
  const connScrolled = new Gtk.ScrolledWindow({
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
    vexpand: true,
  });
  connScrolled.set_child(buildPropertyForm(connectorProperties, onPropertyChange));
  connSection.append(connScrolled);
  stack.add_named(connSection, 'connector');

  // Canvas properties
  const canvasSection = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  const canvasTitle = new Gtk.Label({ label: 'Canvas Properties', xalign: 0 });
  canvasTitle.set_margin_start(12);
  canvasTitle.get_style_context().add_class('dim-label');
  canvasSection.append(canvasTitle);
  const canvasScrolled = new Gtk.ScrolledWindow({
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
    vexpand: true,
  });
  canvasScrolled.set_child(buildPropertyForm(canvasProperties, onPropertyChange));
  canvasSection.append(canvasScrolled);
  stack.add_named(canvasSection, 'canvas');

  // Set active page
  stack.set_visible_child_name(selectionType);

  root.append(stack);

  return root;
}
