// ============================================================
// Clef Surface NativeScript Widget — MultiSelect
//
// Dropdown selector allowing multiple selections with tag
// display for chosen items.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';

// --------------- Props ---------------

export interface MultiSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  value?: string[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  open?: boolean;
  onChange?: (value: string[]) => void;
  onOpenChange?: (open: boolean) => void;
}

// --------------- Component ---------------

export function createMultiSelect(props: MultiSelectProps): StackLayout {
  const {
    options = [],
    value = [],
    placeholder = 'Select...',
    label,
    disabled = false,
    open = false,
    onChange,
    onOpenChange,
  } = props;

  let selected = [...value];

  const container = new StackLayout();
  container.className = 'clef-widget-multi-select';

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    lbl.fontWeight = 'bold';
    lbl.marginBottom = 4;
    container.addChild(lbl);
  }

  const trigger = new Button();
  trigger.text = selected.length > 0
    ? `${selected.length} selected`
    : placeholder;
  trigger.isEnabled = !disabled;
  trigger.className = 'clef-multi-select-trigger';
  trigger.accessibilityRole = 'button';
  trigger.on('tap', () => onOpenChange?.(!open));
  container.addChild(trigger);

  const dropdown = new StackLayout();
  dropdown.className = 'clef-multi-select-dropdown';
  dropdown.visibility = open ? 'visible' : 'collapsed';

  for (const opt of options) {
    const isSelected = selected.includes(opt.value);
    const row = new StackLayout();
    row.orientation = 'horizontal';
    row.padding = '8 12';
    row.className = 'clef-multi-select-option';

    const check = new Label();
    check.text = isSelected ? '\u2611' : '\u2610';
    check.marginRight = 8;
    row.addChild(check);

    const optLabel = new Label();
    optLabel.text = opt.label;
    if (opt.disabled) optLabel.opacity = 0.5;
    row.addChild(optLabel);

    if (!opt.disabled) {
      row.on('tap', () => {
        if (isSelected) {
          selected = selected.filter((v: string) => v !== opt.value);
        } else {
          selected = [...selected, opt.value];
        }
        onChange?.(selected);
      });
    }

    dropdown.addChild(row);
  }

  container.addChild(dropdown);
  return container;
}

export default createMultiSelect;
