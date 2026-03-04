// ============================================================
// Clef Surface GTK Widget — InlineEdit
//
// Click-to-edit text field. Shows as a label that transforms
// into an editable entry on click/activation.
//
// Adapts the inline-edit.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface InlineEditProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onSave?: (value: string) => void;
  onCancel?: () => void;
}

// --------------- Component ---------------

export function createInlineEdit(props: InlineEditProps = {}): Gtk.Widget {
  const { value = '', placeholder = 'Click to edit', disabled = false, onSave, onCancel } = props;

  const stack = new Gtk.Stack({ transitionType: Gtk.StackTransitionType.CROSSFADE });

  // Display mode
  const displayBtn = new Gtk.Button({ label: value || placeholder });
  displayBtn.get_style_context().add_class('flat');
  displayBtn.set_sensitive(!disabled);
  stack.add_named(displayBtn, 'display');

  // Edit mode
  const editBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
  const entry = new Gtk.Entry({ text: value });
  editBox.append(entry);

  const saveBtn = new Gtk.Button({ iconName: 'object-select-symbolic' });
  saveBtn.get_style_context().add_class('suggested-action');
  editBox.append(saveBtn);

  const cancelBtn = new Gtk.Button({ iconName: 'process-stop-symbolic' });
  editBox.append(cancelBtn);

  stack.add_named(editBox, 'edit');

  displayBtn.connect('clicked', () => {
    entry.set_text(value);
    stack.set_visible_child_name('edit');
    entry.grab_focus();
  });

  saveBtn.connect('clicked', () => {
    onSave?.(entry.get_text());
    displayBtn.set_label(entry.get_text() || placeholder);
    stack.set_visible_child_name('display');
  });

  cancelBtn.connect('clicked', () => {
    onCancel?.();
    stack.set_visible_child_name('display');
  });

  entry.connect('activate', () => {
    onSave?.(entry.get_text());
    displayBtn.set_label(entry.get_text() || placeholder);
    stack.set_visible_child_name('display');
  });

  stack.set_visible_child_name('display');
  return stack;
}
