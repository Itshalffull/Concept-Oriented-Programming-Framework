// ============================================================
// Clef Surface NativeScript Widget — Select
//
// Single-selection dropdown with trigger button and option
// list. Supports placeholder, disabled, and required states.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';

// --------------- Props ---------------

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  open?: boolean;
  onChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
}

// --------------- Component ---------------

export function createSelect(props: SelectProps): StackLayout {
  const {
    options = [],
    value,
    placeholder = 'Select...',
    label,
    disabled = false,
    required = false,
    open = false,
    onChange,
    onOpenChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-select';

  if (label) {
    const lbl = new Label();
    lbl.text = required ? `${label} *` : label;
    lbl.fontWeight = 'bold';
    lbl.marginBottom = 4;
    container.addChild(lbl);
  }

  const selectedOpt = options.find((o) => o.value === value);
  const trigger = new Button();
  trigger.text = selectedOpt ? selectedOpt.label : placeholder;
  trigger.isEnabled = !disabled;
  trigger.className = 'clef-select-trigger';
  trigger.accessibilityRole = 'button';
  trigger.on('tap', () => onOpenChange?.(!open));
  container.addChild(trigger);

  const dropdown = new StackLayout();
  dropdown.className = 'clef-select-dropdown';
  dropdown.visibility = open ? 'visible' : 'collapsed';

  for (const opt of options) {
    const item = new Label();
    item.text = opt.label;
    item.padding = '8 12';
    item.className = `clef-select-option${opt.value === value ? ' clef-selected' : ''}`;
    if (opt.disabled) {
      item.opacity = 0.5;
    } else {
      item.on('tap', () => {
        onChange?.(opt.value);
        onOpenChange?.(false);
      });
    }
    dropdown.addChild(item);
  }

  container.addChild(dropdown);
  return container;
}

export default createSelect;
