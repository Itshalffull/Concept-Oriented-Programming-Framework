// ============================================================
// Clef Surface GTK Widget — SortBuilder
//
// Dynamic sort rule builder. Allows adding/removing sort
// rules with field and direction selectors.
//
// Adapts the sort-builder.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export type SortDirection = 'ascending' | 'descending';
export interface SortFieldDef { id: string; label: string; }
export interface SortRule { field: string; direction: SortDirection; }

// --------------- Props ---------------

export interface SortBuilderProps {
  fields?: SortFieldDef[];
  rules?: SortRule[];
  onChange?: (rules: SortRule[]) => void;
}

// --------------- Component ---------------

export function createSortBuilder(props: SortBuilderProps = {}): Gtk.Widget {
  const { fields = [], rules = [], onChange } = props;
  const currentRules = [...rules];

  const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });

  function rebuild(): void {
    let child = container.get_first_child();
    while (child) { const next = child.get_next_sibling(); container.remove(child); child = next; }

    currentRules.forEach((rule, idx) => {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });

      const fieldDropdown = Gtk.DropDown.new(Gtk.StringList.new(fields.map((f) => f.label)), null);
      const fIdx = fields.findIndex((f) => f.id === rule.field);
      if (fIdx >= 0) fieldDropdown.set_selected(fIdx);
      fieldDropdown.connect('notify::selected', () => {
        const sel = fieldDropdown.get_selected();
        if (sel >= 0 && sel < fields.length) { currentRules[idx] = { ...currentRules[idx], field: fields[sel].id }; onChange?.([...currentRules]); }
      });
      row.append(fieldDropdown);

      const dirs: SortDirection[] = ['ascending', 'descending'];
      const dirDropdown = Gtk.DropDown.new(Gtk.StringList.new(dirs), null);
      dirDropdown.set_selected(dirs.indexOf(rule.direction));
      dirDropdown.connect('notify::selected', () => {
        const sel = dirDropdown.get_selected();
        if (sel >= 0) { currentRules[idx] = { ...currentRules[idx], direction: dirs[sel] }; onChange?.([...currentRules]); }
      });
      row.append(dirDropdown);

      const removeBtn = new Gtk.Button({ iconName: 'list-remove-symbolic' });
      removeBtn.get_style_context().add_class('flat');
      removeBtn.connect('clicked', () => { currentRules.splice(idx, 1); rebuild(); onChange?.([...currentRules]); });
      row.append(removeBtn);

      container.append(row);
    });

    const addBtn = new Gtk.Button({ label: '+ Add Sort Rule' });
    addBtn.get_style_context().add_class('flat');
    addBtn.connect('clicked', () => { currentRules.push({ field: fields[0]?.id ?? '', direction: 'ascending' }); rebuild(); onChange?.([...currentRules]); });
    container.append(addBtn);
  }

  rebuild();
  return container;
}
