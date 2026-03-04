// ============================================================
// Clef Surface NativeScript Widget — Combobox
//
// Autocomplete input with dropdown suggestions list.
// Filters options as the user types.
// ============================================================

import { StackLayout, Label, TextField, ListView } from '@nativescript/core';

// --------------- Props ---------------

export interface ComboboxOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  open?: boolean;
  onSelect?: (value: string) => void;
  onInputChange?: (query: string) => void;
  onOpenChange?: (open: boolean) => void;
}

// --------------- Component ---------------

export function createCombobox(props: ComboboxProps): StackLayout {
  const {
    options = [],
    value = '',
    placeholder = 'Search...',
    label,
    disabled = false,
    open = false,
    onSelect,
    onInputChange,
    onOpenChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-combobox';

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    lbl.fontWeight = 'bold';
    lbl.marginBottom = 4;
    container.addChild(lbl);
  }

  const input = new TextField();
  input.text = value;
  input.hint = placeholder;
  input.isEnabled = !disabled;
  input.className = 'clef-combobox-input';
  input.accessibilityRole = 'search';

  input.on('textChange', (args: any) => {
    onInputChange?.(args.object.text);
    onOpenChange?.(true);
  });

  input.on('focus', () => onOpenChange?.(true));

  container.addChild(input);

  const listContainer = new StackLayout();
  listContainer.className = 'clef-combobox-dropdown';
  listContainer.visibility = open ? 'visible' : 'collapsed';

  for (const opt of options) {
    const item = new Label();
    item.text = opt.label;
    item.padding = '8 12';
    item.className = 'clef-combobox-option';
    if (opt.disabled) {
      item.opacity = 0.5;
    } else {
      item.on('tap', () => {
        onSelect?.(opt.value);
        onOpenChange?.(false);
      });
    }
    listContainer.addChild(item);
  }

  container.addChild(listContainer);
  return container;
}

export default createCombobox;
