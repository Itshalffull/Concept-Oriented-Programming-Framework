// ============================================================
// Clef Surface GTK Widget — PolicyEditor
//
// Access control policy editor with subject, action, resource,
// and effect configuration per policy rule.
//
// Adapts the policy-editor.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface PolicyRule { id: string; subject: string; action: string; resource: string; effect: 'allow' | 'deny'; }

// --------------- Props ---------------

export interface PolicyEditorProps {
  rules?: PolicyRule[];
  onAddRule?: () => void;
  onRemoveRule?: (id: string) => void;
  onRuleChange?: (rule: PolicyRule) => void;
}

// --------------- Component ---------------

export function createPolicyEditor(props: PolicyEditorProps = {}): Gtk.Widget {
  const { rules = [], onAddRule, onRemoveRule, onRuleChange } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  const header = new Gtk.Label({ label: 'Policy Rules', xalign: 0 });
  header.get_style_context().add_class('heading');
  box.append(header);

  rules.forEach((rule) => {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
    row.get_style_context().add_class('card');

    const effectLabel = new Gtk.Label({ label: rule.effect.toUpperCase() });
    effectLabel.get_style_context().add_class(rule.effect === 'allow' ? 'success' : 'error');
    row.append(effectLabel);

    row.append(new Gtk.Entry({ text: rule.subject, placeholderText: 'Subject' }));
    row.append(new Gtk.Entry({ text: rule.action, placeholderText: 'Action' }));
    row.append(new Gtk.Entry({ text: rule.resource, placeholderText: 'Resource', hexpand: true }));

    const removeBtn = new Gtk.Button({ iconName: 'list-remove-symbolic' });
    removeBtn.get_style_context().add_class('flat');
    removeBtn.connect('clicked', () => onRemoveRule?.(rule.id));
    row.append(removeBtn);

    box.append(row);
  });

  const addBtn = new Gtk.Button({ label: '+ Add Rule' });
  addBtn.get_style_context().add_class('flat');
  if (onAddRule) addBtn.connect('clicked', onAddRule);
  box.append(addBtn);

  return box;
}
