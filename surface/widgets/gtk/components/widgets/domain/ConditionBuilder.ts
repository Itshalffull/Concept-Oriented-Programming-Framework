// ============================================================
// Clef Surface GTK Widget — ConditionBuilder
//
// Nested boolean condition/expression builder with AND/OR
// groups. Similar to FilterBuilder but supports nesting.
//
// Adapts the condition-builder.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface Condition { field: string; operator: string; value: string; }
export interface ConditionGroup { logic: 'AND' | 'OR'; conditions: Condition[]; }

// --------------- Props ---------------

export interface ConditionBuilderProps {
  groups?: ConditionGroup[];
  fields?: string[];
  operators?: string[];
  onChange?: (groups: ConditionGroup[]) => void;
}

// --------------- Component ---------------

export function createConditionBuilder(props: ConditionBuilderProps = {}): Gtk.Widget {
  const { groups = [], fields = [], operators = ['equals', 'contains', 'greater than', 'less than'], onChange } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 });

  groups.forEach((group, gIdx) => {
    const groupBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
    groupBox.get_style_context().add_class('card');

    const logicLabel = new Gtk.Label({ label: group.logic, xalign: 0 });
    logicLabel.get_style_context().add_class('heading');
    groupBox.append(logicLabel);

    group.conditions.forEach((cond, cIdx) => {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      row.append(new Gtk.Entry({ text: cond.field, placeholderText: 'Field' }));
      row.append(new Gtk.Entry({ text: cond.operator, placeholderText: 'Operator' }));
      row.append(new Gtk.Entry({ text: cond.value, placeholderText: 'Value', hexpand: true }));
      groupBox.append(row);
    });

    box.append(groupBox);
    if (gIdx < groups.length - 1) {
      box.append(new Gtk.Label({ label: 'AND', halign: Gtk.Align.CENTER }));
    }
  });

  return box;
}
