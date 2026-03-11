// ============================================================
// Clef Surface GTK Widget — SchemaEditor
//
// JSON/data schema editor with field type selection,
// name editing, and required/optional toggles per field.
//
// Adapts the schema-editor.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface SchemaField { name: string; type: string; required: boolean; }

// --------------- Props ---------------

export interface SchemaEditorProps {
  fields?: SchemaField[];
  types?: string[];
  onChange?: (fields: SchemaField[]) => void;
}

// --------------- Component ---------------

export function createSchemaEditor(props: SchemaEditorProps = {}): Gtk.Widget {
  const { fields = [], types = ['string', 'number', 'boolean', 'array', 'object'], onChange } = props;
  const currentFields = [...fields];

  const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  const header = new Gtk.Label({ label: 'Schema Editor', xalign: 0 });
  header.get_style_context().add_class('heading');
  container.append(header);

  function rebuild(): void {
    let child = container.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      if (child !== header) container.remove(child);
      child = next;
    }

    currentFields.forEach((field, idx) => {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });

      const nameEntry = new Gtk.Entry({ text: field.name, placeholderText: 'Field name', hexpand: true });
      nameEntry.connect('changed', () => { currentFields[idx] = { ...currentFields[idx], name: nameEntry.get_text() }; onChange?.([...currentFields]); });
      row.append(nameEntry);

      const typeDropdown = Gtk.DropDown.new(Gtk.StringList.new(types), null);
      const typeIdx = types.indexOf(field.type);
      if (typeIdx >= 0) typeDropdown.set_selected(typeIdx);
      typeDropdown.connect('notify::selected', () => {
        const sel = typeDropdown.get_selected();
        if (sel >= 0 && sel < types.length) { currentFields[idx] = { ...currentFields[idx], type: types[sel] }; onChange?.([...currentFields]); }
      });
      row.append(typeDropdown);

      const reqCheck = new Gtk.CheckButton({ label: 'Required', active: field.required });
      reqCheck.connect('toggled', () => { currentFields[idx] = { ...currentFields[idx], required: reqCheck.get_active() }; onChange?.([...currentFields]); });
      row.append(reqCheck);

      const removeBtn = new Gtk.Button({ iconName: 'list-remove-symbolic' });
      removeBtn.get_style_context().add_class('flat');
      removeBtn.connect('clicked', () => { currentFields.splice(idx, 1); rebuild(); onChange?.([...currentFields]); });
      row.append(removeBtn);

      container.append(row);
    });

    const addBtn = new Gtk.Button({ label: '+ Add Field' });
    addBtn.get_style_context().add_class('flat');
    addBtn.connect('clicked', () => { currentFields.push({ name: '', type: 'string', required: false }); rebuild(); onChange?.([...currentFields]); });
    container.append(addBtn);
  }

  rebuild();
  return container;
}
