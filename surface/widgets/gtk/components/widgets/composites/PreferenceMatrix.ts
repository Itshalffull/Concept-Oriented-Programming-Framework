// ============================================================
// Clef Surface GTK Widget — PreferenceMatrix
//
// Categorized preferences editor. Groups preference items by
// category with type-appropriate input controls.
//
// Adapts the preference-matrix.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

// --------------- Types ---------------

export type PreferenceType = 'boolean' | 'string' | 'number' | 'select';
export interface PreferenceCategory { id: string; label: string; }
export interface Preference { id: string; label: string; description?: string; type: PreferenceType; value: any; category: string; options?: string[]; }

// --------------- Props ---------------

export interface PreferenceMatrixProps {
  categories?: PreferenceCategory[];
  preferences?: Preference[];
  onChange?: (id: string, value: any) => void;
}

// --------------- Component ---------------

export function createPreferenceMatrix(props: PreferenceMatrixProps = {}): Gtk.Widget {
  const { categories = [], preferences = [], onChange } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 16 });

  categories.forEach((cat) => {
    const group = new Adw.PreferencesGroup({ title: cat.label });
    const catPrefs = preferences.filter((p) => p.category === cat.id);

    catPrefs.forEach((pref) => {
      const row = new Adw.ActionRow({ title: pref.label, subtitle: pref.description ?? '' });

      switch (pref.type) {
        case 'boolean': {
          const sw = new Gtk.Switch({ active: pref.value, valign: Gtk.Align.CENTER });
          sw.connect('notify::active', () => onChange?.(pref.id, sw.get_active()));
          row.add_suffix(sw);
          row.set_activatable_widget(sw);
          break;
        }
        case 'string': {
          const entry = new Gtk.Entry({ text: pref.value ?? '', valign: Gtk.Align.CENTER });
          entry.connect('changed', () => onChange?.(pref.id, entry.get_text()));
          row.add_suffix(entry);
          break;
        }
        case 'number': {
          const adj = new Gtk.Adjustment({ value: pref.value ?? 0, lower: -999999, upper: 999999, stepIncrement: 1, pageIncrement: 10, pageSize: 0 });
          const spin = new Gtk.SpinButton({ adjustment: adj, valign: Gtk.Align.CENTER });
          spin.connect('value-changed', () => onChange?.(pref.id, spin.get_value()));
          row.add_suffix(spin);
          break;
        }
        case 'select': {
          const options = pref.options ?? [];
          const dropdown = new Gtk.DropDown({ model: Gtk.StringList.new(options), valign: Gtk.Align.CENTER });
          const idx = options.indexOf(pref.value);
          if (idx >= 0) dropdown.set_selected(idx);
          dropdown.connect('notify::selected', () => {
            const sel = dropdown.get_selected();
            if (sel >= 0 && sel < options.length) onChange?.(pref.id, options[sel]);
          });
          row.add_suffix(dropdown);
          break;
        }
      }

      group.add(row);
    });

    box.append(group);
  });

  return box;
}
