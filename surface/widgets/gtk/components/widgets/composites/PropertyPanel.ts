// ============================================================
// Clef Surface GTK Widget — PropertyPanel
//
// Property inspector panel showing editable key-value properties
// with type-appropriate input controls.
//
// Adapts the property-panel.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export type PropertyType = 'string' | 'number' | 'boolean' | 'color';
export interface Property { key: string; label: string; type: PropertyType; value: any; }

// --------------- Props ---------------

export interface PropertyPanelProps {
  properties?: Property[];
  title?: string;
  onChange?: (key: string, value: any) => void;
}

// --------------- Component ---------------

export function createPropertyPanel(props: PropertyPanelProps = {}): Gtk.Widget {
  const { properties = [], title = 'Properties', onChange } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  const header = new Gtk.Label({ label: title, xalign: 0 });
  header.get_style_context().add_class('heading');
  box.append(header);

  const grid = new Gtk.Grid({ columnSpacing: 8, rowSpacing: 4 });

  properties.forEach((prop, idx) => {
    grid.attach(new Gtk.Label({ label: prop.label, xalign: 0 }), 0, idx, 1, 1);

    switch (prop.type) {
      case 'boolean': {
        const sw = new Gtk.Switch({ active: prop.value });
        sw.connect('notify::active', () => onChange?.(prop.key, sw.get_active()));
        grid.attach(sw, 1, idx, 1, 1);
        break;
      }
      case 'number': {
        const adj = new Gtk.Adjustment({ value: prop.value ?? 0, lower: -999999, upper: 999999, stepIncrement: 1, pageIncrement: 10, pageSize: 0 });
        const spin = new Gtk.SpinButton({ adjustment: adj });
        spin.connect('value-changed', () => onChange?.(prop.key, spin.get_value()));
        grid.attach(spin, 1, idx, 1, 1);
        break;
      }
      default: {
        const entry = new Gtk.Entry({ text: String(prop.value ?? ''), hexpand: true });
        entry.connect('changed', () => onChange?.(prop.key, entry.get_text()));
        grid.attach(entry, 1, idx, 1, 1);
        break;
      }
    }
  });

  box.append(grid);
  return box;
}
