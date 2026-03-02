// ============================================================
// Clef Surface NativeScript Widget — ToggleSwitch
//
// Toggle on/off switch using NativeScript's native Switch.
// Displays a label alongside the switch control with optional
// description text and on/off state labels.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Switch,
  Color,
} from '@nativescript/core';

// --------------- Props ---------------

export interface ToggleSwitchProps {
  value?: boolean;
  label?: string;
  description?: string;
  onLabel?: string;
  offLabel?: string;
  disabled?: boolean;
  accentColor?: string;
  onChange?: (value: boolean) => void;
}

// --------------- Component ---------------

export function createToggleSwitch(props: ToggleSwitchProps = {}): StackLayout {
  const {
    value: initialValue = false,
    label,
    description,
    onLabel = 'On',
    offLabel = 'Off',
    disabled = false,
    accentColor = '#2196F3',
    onChange,
  } = props;

  let currentValue = initialValue;

  const container = new StackLayout();
  container.className = 'clef-toggle-switch';
  container.opacity = disabled ? 0.5 : 1;

  const controlRow = new GridLayout();
  controlRow.columns = '*, auto, auto';
  controlRow.className = 'clef-toggle-switch-row';
  controlRow.verticalAlignment = 'middle';

  // Label section
  const labelContainer = new StackLayout();
  labelContainer.col = 0;
  labelContainer.verticalAlignment = 'middle';

  if (label) {
    const titleLabel = new Label();
    titleLabel.text = label;
    titleLabel.className = 'clef-toggle-switch-label';
    titleLabel.fontWeight = 'bold';
    labelContainer.addChild(titleLabel);
  }

  if (description) {
    const descLabel = new Label();
    descLabel.text = description;
    descLabel.className = 'clef-toggle-switch-desc';
    descLabel.fontSize = 12;
    descLabel.opacity = 0.6;
    descLabel.textWrap = true;
    labelContainer.addChild(descLabel);
  }

  controlRow.addChild(labelContainer);

  // State label
  const stateLabel = new Label();
  stateLabel.col = 1;
  stateLabel.text = currentValue ? onLabel : offLabel;
  stateLabel.className = 'clef-toggle-switch-state';
  stateLabel.fontSize = 12;
  stateLabel.opacity = 0.7;
  stateLabel.marginRight = 8;
  stateLabel.verticalAlignment = 'middle';
  stateLabel.color = currentValue ? new Color(accentColor) : undefined;
  controlRow.addChild(stateLabel);

  // Native switch
  const toggle = new Switch();
  toggle.col = 2;
  toggle.className = 'clef-toggle-switch-control';
  toggle.checked = currentValue;
  toggle.isEnabled = !disabled;

  toggle.on('checkedChange', () => {
    currentValue = toggle.checked;
    stateLabel.text = currentValue ? onLabel : offLabel;
    stateLabel.color = currentValue ? new Color(accentColor) : undefined;
    onChange?.(currentValue);
  });

  controlRow.addChild(toggle);
  container.addChild(controlRow);

  return container;
}

createToggleSwitch.displayName = 'ToggleSwitch';
export default createToggleSwitch;
