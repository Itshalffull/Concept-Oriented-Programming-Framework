// ============================================================
// Clef Surface NativeScript Widget — ComboboxMulti
//
// Multi-select combobox with chip display for selected items
// and filterable dropdown list.
// ============================================================

import { StackLayout, Label, TextField, Button } from '@nativescript/core';

// --------------- Props ---------------

export interface ComboboxMultiOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface ComboboxMultiProps {
  options: ComboboxMultiOption[];
  value?: string[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  open?: boolean;
  onSelect?: (value: string[]) => void;
  onInputChange?: (query: string) => void;
  onOpenChange?: (open: boolean) => void;
}

// --------------- Component ---------------

export function createComboboxMulti(props: ComboboxMultiProps): StackLayout {
  const {
    options = [],
    value = [],
    placeholder = 'Search...',
    label,
    disabled = false,
    open = false,
    onSelect,
    onInputChange,
    onOpenChange,
  } = props;

  let selected = [...value];

  const container = new StackLayout();
  container.className = 'clef-widget-combobox-multi';

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    lbl.fontWeight = 'bold';
    lbl.marginBottom = 4;
    container.addChild(lbl);
  }

  const chipsRow = new StackLayout();
  chipsRow.orientation = 'horizontal';
  chipsRow.className = 'clef-combobox-multi-chips';

  for (const val of selected) {
    const opt = options.find((o) => o.value === val);
    if (!opt) continue;
    const chip = new StackLayout();
    chip.orientation = 'horizontal';
    chip.padding = '2 6';

    const chipLabel = new Label();
    chipLabel.text = opt.label;
    chip.addChild(chipLabel);

    const removeBtn = new Button();
    removeBtn.text = '\u2715';
    removeBtn.className = 'clef-chip-remove';
    removeBtn.on('tap', () => {
      selected = selected.filter((v: string) => v !== val);
      onSelect?.(selected);
    });
    chip.addChild(removeBtn);

    chipsRow.addChild(chip);
  }

  container.addChild(chipsRow);

  const input = new TextField();
  input.hint = placeholder;
  input.isEnabled = !disabled;
  input.className = 'clef-combobox-multi-input';

  input.on('textChange', (args: any) => {
    onInputChange?.(args.object.text);
    onOpenChange?.(true);
  });

  container.addChild(input);

  const listContainer = new StackLayout();
  listContainer.className = 'clef-combobox-multi-dropdown';
  listContainer.visibility = open ? 'visible' : 'collapsed';

  for (const opt of options) {
    const isSelected = selected.includes(opt.value);
    const item = new Label();
    item.text = `${isSelected ? '\u2713 ' : ''}${opt.label}`;
    item.padding = '8 12';
    item.className = 'clef-combobox-multi-option';
    if (opt.disabled) {
      item.opacity = 0.5;
    } else {
      item.on('tap', () => {
        if (isSelected) {
          selected = selected.filter((v: string) => v !== opt.value);
        } else {
          selected = [...selected, opt.value];
        }
        onSelect?.(selected);
      });
    }
    listContainer.addChild(item);
  }

  container.addChild(listContainer);
  return container;
}

export default createComboboxMulti;
