// ============================================================
// Clef Surface NativeScript Widget — Checkbox
//
// Toggle checkbox with checked, unchecked, and indeterminate
// states. Uses NativeScript Switch mapped to checkbox semantics.
// ============================================================

import {
  StackLayout,
  Label,
  Switch,
} from '@nativescript/core';

// --------------- Props ---------------

export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  required?: boolean;
  value?: string;
  name?: string;
  label?: string;
  onChange?: (checked: boolean) => void;
}

// --------------- Component ---------------

export function createCheckbox(props: CheckboxProps): StackLayout {
  const {
    checked = false,
    indeterminate = false,
    disabled = false,
    required = false,
    value = '',
    name,
    label,
    onChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-checkbox';
  container.orientation = 'horizontal';
  container.verticalAlignment = 'middle';

  const toggle = new Switch();
  toggle.checked = checked;
  toggle.isEnabled = !disabled;
  toggle.accessibilityRole = 'checkbox';
  toggle.accessibilityLabel = label || name || 'Checkbox';
  toggle.accessibilityState = {
    checked: indeterminate ? 'mixed' : checked,
    disabled,
  };

  toggle.on('checkedChange', (args: any) => {
    if (!disabled) {
      onChange?.(args.object.checked);
    }
  });

  container.addChild(toggle);

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    lbl.marginLeft = 8;
    lbl.verticalAlignment = 'middle';
    if (disabled) lbl.opacity = 0.5;
    container.addChild(lbl);
  }

  return container;
}

export default createCheckbox;
