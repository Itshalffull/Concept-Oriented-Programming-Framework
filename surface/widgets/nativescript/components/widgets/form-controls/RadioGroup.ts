// ============================================================
// Clef Surface NativeScript Widget — RadioGroup
//
// Mutually exclusive option group with label and orientation
// control. Only one option can be selected at a time.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

// --------------- Props ---------------

export interface RadioGroupOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  label?: string;
  options: RadioGroupOption[];
  value?: string;
  defaultValue?: string;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export function createRadioGroup(props: RadioGroupProps): StackLayout {
  const {
    label,
    options = [],
    value,
    defaultValue,
    orientation = 'vertical',
    disabled = false,
    onChange,
  } = props;

  let selected = value ?? defaultValue ?? '';

  const container = new StackLayout();
  container.className = 'clef-widget-radio-group';
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
  optionsContainer.className = 'clef-radio-group-options';

  for (const opt of options) {
    const row = new StackLayout();
    row.orientation = 'horizontal';
    row.verticalAlignment = 'middle';
    row.marginBottom = 4;

    const isSelected = selected === opt.value;
    const isDisabled = disabled || !!opt.disabled;

    const indicator = new Label();
    indicator.text = isSelected ? '\u25C9' : '\u25CB';
    indicator.fontSize = 18;
    indicator.marginRight = 8;
    row.addChild(indicator);

    const lbl = new Label();
    lbl.text = opt.label;
    lbl.verticalAlignment = 'middle';
    if (isDisabled) lbl.opacity = 0.5;
    row.addChild(lbl);

    if (!isDisabled) {
      row.on('tap', () => {
        selected = opt.value;
        onChange?.(selected);
      });
    }

    optionsContainer.addChild(row);
  }

  container.addChild(optionsContainer);
  return container;
}

export default createRadioGroup;
