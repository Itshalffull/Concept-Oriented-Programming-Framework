// ============================================================
// Clef Surface NativeScript Widget — Select
//
// Dropdown select for single-value selection. Renders a
// trigger label that opens a list of options on tap.
// Selected option is highlighted and displayed in trigger.
// ============================================================

import { StackLayout, Label, Color } from '@nativescript/core';

// --------------- Types ---------------

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface SelectProps {
  options?: SelectOption[];
  value?: string;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  accentColor?: string;
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export function createSelect(props: SelectProps = {}): StackLayout {
  const {
    options = [],
    value: initialValue = '',
    placeholder = 'Select…',
    label,
    disabled = false,
    accentColor = '#2196F3',
    onChange,
  } = props;

  let currentValue = initialValue;
  let isOpen = false;

  const container = new StackLayout();
  container.className = 'clef-select';
  container.opacity = disabled ? 0.5 : 1;

  if (label) {
    const titleLabel = new Label();
    titleLabel.text = label;
    titleLabel.className = 'clef-select-label';
    titleLabel.fontWeight = 'bold';
    titleLabel.marginBottom = 4;
    container.addChild(titleLabel);
  }

  // Trigger
  const trigger = new Label();
  trigger.className = 'clef-select-trigger';
  const selectedOption = options.find((o) => o.value === currentValue);
  trigger.text = selectedOption ? `${selectedOption.label} ▾` : `${placeholder} ▾`;
  trigger.color = selectedOption ? undefined : new Color('#9ca3af');
  trigger.padding = '8 12';
  trigger.borderBottomWidth = 1;
  trigger.borderBottomColor = new Color('#d1d5db');
  container.addChild(trigger);

  // Dropdown
  const dropdown = new StackLayout();
  dropdown.className = 'clef-select-dropdown';
  dropdown.visibility = 'collapsed';
  dropdown.backgroundColor = new Color('#FFFFFF');
  dropdown.borderWidth = 1;
  dropdown.borderColor = new Color('#e5e7eb');
  dropdown.borderRadius = 4;
  dropdown.marginTop = 2;

  function renderOptions(): void {
    dropdown.removeChildren();
    options.forEach((option) => {
      const row = new Label();
      row.text = option.label;
      row.className = 'clef-select-option';
      row.padding = '8 12';
      row.opacity = option.disabled ? 0.5 : 1;
      row.color = option.value === currentValue ? new Color(accentColor) : undefined;
      row.fontWeight = option.value === currentValue ? 'bold' : 'normal';

      if (!disabled && !option.disabled) {
        row.on('tap', () => {
          currentValue = option.value;
          trigger.text = `${option.label} ▾`;
          trigger.color = undefined;
          dropdown.visibility = 'collapsed';
          isOpen = false;
          onChange?.(option.value);
        });
      }

      dropdown.addChild(row);
    });
  }

  renderOptions();

  if (!disabled) {
    trigger.on('tap', () => {
      isOpen = !isOpen;
      dropdown.visibility = isOpen ? 'visible' : 'collapsed';
      if (isOpen) renderOptions();
    });
  }

  container.addChild(dropdown);
  return container;
}

createSelect.displayName = 'Select';
export default createSelect;
