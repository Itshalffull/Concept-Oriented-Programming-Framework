// ============================================================
// Clef Surface GTK Widget — AutomationBuilder
//
// Visual automation/workflow rule builder with trigger,
// condition, and action configuration steps.
//
// Adapts the automation-builder.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface AutomationStep { id: string; type: 'trigger' | 'condition' | 'action'; label: string; }

// --------------- Props ---------------

export interface AutomationBuilderProps {
  steps?: AutomationStep[];
  onAddStep?: (type: string) => void;
  onRemoveStep?: (id: string) => void;
  onSelectStep?: (id: string) => void;
}

// --------------- Component ---------------

export function createAutomationBuilder(props: AutomationBuilderProps = {}): Gtk.Widget {
  const { steps = [], onAddStep, onRemoveStep, onSelectStep } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  const header = new Gtk.Label({ label: 'Automation Builder', xalign: 0 });
  header.get_style_context().add_class('heading');
  box.append(header);

  steps.forEach((step, idx) => {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    row.get_style_context().add_class('card');

    const typeLabel = new Gtk.Label({ label: `[${step.type}]` });
    typeLabel.get_style_context().add_class('dim-label');
    row.append(typeLabel);

    const btn = new Gtk.Button({ label: step.label, hexpand: true });
    btn.get_style_context().add_class('flat');
    btn.connect('clicked', () => onSelectStep?.(step.id));
    row.append(btn);

    const removeBtn = new Gtk.Button({ iconName: 'list-remove-symbolic' });
    removeBtn.get_style_context().add_class('flat');
    removeBtn.connect('clicked', () => onRemoveStep?.(step.id));
    row.append(removeBtn);

    box.append(row);
    if (idx < steps.length - 1) {
      box.append(new Gtk.Label({ label: '\u2193', halign: Gtk.Align.CENTER }));
    }
  });

  const addRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
  ['trigger', 'condition', 'action'].forEach((type) => {
    const btn = new Gtk.Button({ label: `+ ${type.charAt(0).toUpperCase() + type.slice(1)}` });
    btn.get_style_context().add_class('flat');
    btn.connect('clicked', () => onAddStep?.(type));
    addRow.append(btn);
  });
  box.append(addRow);

  return box;
}
