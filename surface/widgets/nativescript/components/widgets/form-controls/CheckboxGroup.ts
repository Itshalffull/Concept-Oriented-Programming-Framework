// ============================================================
// Clef Surface NativeScript Widget — CheckboxGroup
//
// Group of checkboxes with shared state management, label,
// and orientation control.
// ============================================================

import { StackLayout, Label, Switch } from '@nativescript/core';

// --------------- Props ---------------

export interface CheckboxGroupOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface CheckboxGroupProps {
  label?: string;
  options: CheckboxGroupOption[];
  value?: string[];
  defaultValue?: string[];
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
  onChange?: (value: string[]) => void;
}

// --------------- Component ---------------

export function createCheckboxGroup(props: CheckboxGroupProps): StackLayout {
  const {
    label,
    options = [],
    value,
    defaultValue = [],
    orientation = 'vertical',
    disabled = false,
    onChange,
  } = props;

  let selected = value ?? [...defaultValue];

  const container = new StackLayout();
  container.className = 'clef-widget-checkbox-group';
  container.accessibilityRole = 'none';

  if (label) {
    const groupLabel = new Label();
    groupLabel.text = label;
    groupLabel.fontWeight = 'bold';
    groupLabel.marginBottom = 8;
    container.addChild(groupLabel);
  }

  const optionsContainer = new StackLayout();
  optionsContainer.orientation = orientation;
  optionsContainer.className = 'clef-checkbox-group-options';

  for (const opt of options) {
    const row = new StackLayout();
    row.orientation = 'horizontal';
    row.verticalAlignment = 'middle';
    row.marginBottom = 4;

    const toggle = new Switch();
    toggle.checked = selected.includes(opt.value);
    toggle.isEnabled = !disabled && !opt.disabled;
    toggle.accessibilityLabel = opt.label;

    toggle.on('checkedChange', (args: any) => {
      const checked = args.object.checked;
      if (checked) {
        if (!selected.includes(opt.value)) selected = [...selected, opt.value];
      } else {
        selected = selected.filter((v: string) => v !== opt.value);
      }
      onChange?.(selected);
    });

    row.addChild(toggle);

    const lbl = new Label();
    lbl.text = opt.label;
    lbl.marginLeft = 8;
    lbl.verticalAlignment = 'middle';
    if (disabled || opt.disabled) lbl.opacity = 0.5;
    row.addChild(lbl);

    optionsContainer.addChild(row);
  }

  container.addChild(optionsContainer);
  return container;
}

export default createCheckboxGroup;
