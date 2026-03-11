// ============================================================
// Clef Surface NativeScript Widget — CommandPalette
//
// Searchable command launcher with keyboard navigation.
// ============================================================

import { StackLayout, Label, TextField } from '@nativescript/core';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  group?: string;
  disabled?: boolean;
}

export interface CommandPaletteProps {
  open?: boolean;
  items: CommandItem[];
  placeholder?: string;
  onSelect?: (id: string) => void;
  onOpenChange?: (open: boolean) => void;
}

export function createCommandPalette(props: CommandPaletteProps): StackLayout {
  const { open = false, items, placeholder = 'Type a command...', onSelect, onOpenChange } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-command-palette';
  container.visibility = open ? 'visible' : 'collapsed';
  container.accessibilityRole = 'dialog';
  container.accessibilityLabel = 'Command palette';

  const field = new TextField();
  field.hint = placeholder;
  field.accessibilityLabel = 'Search commands';
  container.addChild(field);

  const list = new StackLayout();
  list.className = 'clef-command-palette-list';
  for (const item of items) {
    const row = new StackLayout();
    row.orientation = 'horizontal';
    row.padding = '8 12';
    const label = new Label();
    label.text = item.label;
    row.addChild(label);
    if (item.shortcut) {
      const shortcut = new Label();
      shortcut.text = item.shortcut;
      shortcut.opacity = 0.5;
      shortcut.marginLeft = 8;
      row.addChild(shortcut);
    }
    if (!item.disabled) {
      row.on('tap', () => { onSelect?.(item.id); onOpenChange?.(false); });
    }
    list.addChild(row);
  }
  container.addChild(list);
  return container;
}

export default createCommandPalette;
