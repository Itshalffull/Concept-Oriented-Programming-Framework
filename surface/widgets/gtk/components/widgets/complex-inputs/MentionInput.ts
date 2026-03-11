// ============================================================
// Clef Surface GTK Widget — MentionInput
//
// Text input with @-mention autocomplete. Uses Gtk.Entry with
// a Gtk.Popover suggestion list that appears when the user
// types the trigger character.
//
// Adapts the mention-input.widget spec: anatomy (root, input,
// suggestionList, suggestionItem, mention), states (idle,
// mentioning, suggesting), and connect attributes to GTK4
// rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface MentionSuggestion {
  id: string;
  label: string;
  description?: string;
}

// --------------- Props ---------------

export interface MentionInputProps {
  value?: string;
  suggestions?: MentionSuggestion[];
  triggerChar?: string;
  placeholder?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  onMention?: (id: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 mention input with @-trigger autocomplete
 * suggestions in a popover list.
 */
export function createMentionInput(props: MentionInputProps = {}): Gtk.Widget {
  const {
    value = '',
    suggestions = [],
    triggerChar = '@',
    placeholder = 'Type @ to mention...',
    disabled = false,
    onValueChange,
    onMention,
  } = props;

  const entry = new Gtk.Entry({
    text: value,
    placeholderText: placeholder,
  });
  entry.set_sensitive(!disabled);

  const popover = new Gtk.Popover();
  const listBox = new Gtk.ListBox({
    selectionMode: Gtk.SelectionMode.SINGLE,
  });
  popover.set_child(listBox);
  popover.set_parent(entry);
  popover.set_autohide(true);

  suggestions.forEach((sug) => {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 });
    row.append(new Gtk.Label({ label: sug.label, xalign: 0 }));
    if (sug.description) {
      const desc = new Gtk.Label({ label: sug.description, xalign: 0 });
      desc.get_style_context().add_class('dim-label');
      row.append(desc);
    }
    const listRow = new Gtk.ListBoxRow();
    listRow.set_child(row);
    (listRow as any)._sugId = sug.id;
    (listRow as any)._sugLabel = sug.label;
    listBox.append(listRow);
  });

  listBox.connect('row-activated', (_lb: Gtk.ListBox, row: Gtk.ListBoxRow) => {
    const id = (row as any)._sugId;
    const label = (row as any)._sugLabel;
    const text = entry.get_text();
    const lastTrigger = text.lastIndexOf(triggerChar);
    const newText = text.substring(0, lastTrigger) + `${triggerChar}${label} `;
    entry.set_text(newText);
    entry.set_position(newText.length);
    popover.popdown();
    onMention?.(id);
    onValueChange?.(newText);
  });

  entry.connect('changed', () => {
    const text = entry.get_text();
    onValueChange?.(text);
    if (text.endsWith(triggerChar) || (text.includes(triggerChar) && !text.endsWith(' '))) {
      popover.popup();
    } else {
      popover.popdown();
    }
  });

  return entry;
}
