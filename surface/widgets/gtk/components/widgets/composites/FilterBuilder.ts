// ============================================================
// Clef Surface GTK Widget — FilterBuilder
//
// Dynamic filter rule builder. Allows adding/removing filter
// rows with field, operator, and value selectors.
//
// Adapts the filter-builder.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface FieldDef { id: string; label: string; }
export interface OperatorDef { id: string; label: string; }
export interface FilterRow { field: string; operator: string; value: string; }

// --------------- Props ---------------

export interface FilterBuilderProps {
  fields?: FieldDef[];
  operators?: OperatorDef[];
  rows?: FilterRow[];
  onChange?: (rows: FilterRow[]) => void;
}

// --------------- Component ---------------

export function createFilterBuilder(props: FilterBuilderProps = {}): Gtk.Widget {
  const { fields = [], operators = [], rows = [], onChange } = props;
  const currentRows = [...rows];

  const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });

  function rebuild(): void {
    let child = container.get_first_child();
    while (child) { const next = child.get_next_sibling(); container.remove(child); child = next; }

    currentRows.forEach((row, idx) => {
      const rowBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });

      const fieldDropdown = Gtk.DropDown.new(Gtk.StringList.new(fields.map((f) => f.label)), null);
      const fieldIdx = fields.findIndex((f) => f.id === row.field);
      if (fieldIdx >= 0) fieldDropdown.set_selected(fieldIdx);
      fieldDropdown.connect('notify::selected', () => {
        const sel = fieldDropdown.get_selected();
        if (sel >= 0 && sel < fields.length) { currentRows[idx] = { ...currentRows[idx], field: fields[sel].id }; onChange?.([...currentRows]); }
      });
      rowBox.append(fieldDropdown);

      const opDropdown = Gtk.DropDown.new(Gtk.StringList.new(operators.map((o) => o.label)), null);
      const opIdx = operators.findIndex((o) => o.id === row.operator);
      if (opIdx >= 0) opDropdown.set_selected(opIdx);
      opDropdown.connect('notify::selected', () => {
        const sel = opDropdown.get_selected();
        if (sel >= 0 && sel < operators.length) { currentRows[idx] = { ...currentRows[idx], operator: operators[sel].id }; onChange?.([...currentRows]); }
      });
      rowBox.append(opDropdown);

      const valueEntry = new Gtk.Entry({ text: row.value, hexpand: true });
      valueEntry.connect('changed', () => { currentRows[idx] = { ...currentRows[idx], value: valueEntry.get_text() }; onChange?.([...currentRows]); });
      rowBox.append(valueEntry);

      const removeBtn = new Gtk.Button({ iconName: 'list-remove-symbolic' });
      removeBtn.get_style_context().add_class('flat');
      removeBtn.connect('clicked', () => { currentRows.splice(idx, 1); rebuild(); onChange?.([...currentRows]); });
      rowBox.append(removeBtn);

      container.append(rowBox);
    });

    const addBtn = new Gtk.Button({ label: '+ Add Filter' });
    addBtn.get_style_context().add_class('flat');
    addBtn.connect('clicked', () => {
      currentRows.push({ field: fields[0]?.id ?? '', operator: operators[0]?.id ?? '', value: '' });
      rebuild(); onChange?.([...currentRows]);
    });
    container.append(addBtn);
  }

  rebuild();
  return container;
}
