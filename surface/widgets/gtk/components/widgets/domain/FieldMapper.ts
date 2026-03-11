// ============================================================
// Clef Surface GTK Widget — FieldMapper
//
// Two-column field mapping interface for data import/export.
// Source fields on the left map to target fields on the right
// with dropdown selectors.
//
// Adapts the field-mapper.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface FieldMapping { source: string; target: string; }

// --------------- Props ---------------

export interface FieldMapperProps {
  sourceFields?: string[];
  targetFields?: string[];
  mappings?: FieldMapping[];
  onChange?: (mappings: FieldMapping[]) => void;
}

// --------------- Component ---------------

export function createFieldMapper(props: FieldMapperProps = {}): Gtk.Widget {
  const { sourceFields = [], targetFields = [], mappings = [], onChange } = props;

  const grid = new Gtk.Grid({ columnSpacing: 12, rowSpacing: 4 });

  // Headers
  const srcHeader = new Gtk.Label({ label: 'Source' });
  srcHeader.get_style_context().add_class('heading');
  grid.attach(srcHeader, 0, 0, 1, 1);
  grid.attach(new Gtk.Label({ label: '\u2192' }), 1, 0, 1, 1);
  const tgtHeader = new Gtk.Label({ label: 'Target' });
  tgtHeader.get_style_context().add_class('heading');
  grid.attach(tgtHeader, 2, 0, 1, 1);

  mappings.forEach((mapping, idx) => {
    grid.attach(new Gtk.Label({ label: mapping.source, xalign: 0 }), 0, idx + 1, 1, 1);
    grid.attach(new Gtk.Label({ label: '\u2192' }), 1, idx + 1, 1, 1);

    const dropdown = Gtk.DropDown.new(Gtk.StringList.new(['(none)', ...targetFields]), null);
    const tIdx = targetFields.indexOf(mapping.target);
    dropdown.set_selected(tIdx >= 0 ? tIdx + 1 : 0);
    dropdown.connect('notify::selected', () => {
      const sel = dropdown.get_selected();
      const newMappings = [...mappings];
      newMappings[idx] = { ...mapping, target: sel > 0 ? targetFields[sel - 1] : '' };
      onChange?.(newMappings);
    });
    grid.attach(dropdown, 2, idx + 1, 1, 1);
  });

  return grid;
}
