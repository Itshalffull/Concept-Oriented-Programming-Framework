// ============================================================
// Clef Surface NativeScript Widget — ToggleSwitch
//
// On/off toggle switch with label. Wraps NativeScript Switch
// with Clef styling and accessibility.
// ============================================================

import { StackLayout, Label, Switch } from '@nativescript/core';

// --------------- Props ---------------

export interface ToggleSwitchProps {
  checked?: boolean;
  label?: string;
  disabled?: boolean;
  labelPosition?: 'start' | 'end';
  onChange?: (checked: boolean) => void;
}

// --------------- Component ---------------

export function createToggleSwitch(props: ToggleSwitchProps): StackLayout {
  const {
    checked = false,
    label,
    disabled = false,
    labelPosition = 'end',
    onChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-toggle-switch';
  container.orientation = 'horizontal';
  container.verticalAlignment = 'middle';

  const toggle = new Switch();
  toggle.checked = checked;
  toggle.isEnabled = !disabled;
  toggle.accessibilityRole = 'switch';
  toggle.accessibilityLabel = label ?? 'Toggle';
  toggle.accessibilityState = { checked, disabled };

  toggle.on('checkedChange', (args: any) => {
    if (!disabled) onChange?.(args.object.checked);
  });

  const lbl = new Label();
  if (label) {
    lbl.text = label;
    lbl.verticalAlignment = 'middle';
    if (disabled) lbl.opacity = 0.5;
  }

  if (labelPosition === 'start' && label) {
    lbl.marginRight = 8;
    container.addChild(lbl);
    container.addChild(toggle);
  } else {
    container.addChild(toggle);
    if (label) {
      lbl.marginLeft = 8;
      container.addChild(lbl);
    }
  }

  return container;
}

export default createToggleSwitch;
