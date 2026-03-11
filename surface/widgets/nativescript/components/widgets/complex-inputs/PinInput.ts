// ============================================================
// Clef Surface NativeScript Widget — PinInput
//
// Multi-digit PIN/OTP code input with individual fields.
// ============================================================

import { StackLayout, Label, TextField } from '@nativescript/core';

export interface PinInputProps {
  length?: number;
  value?: string;
  mask?: boolean;
  type?: 'numeric' | 'alphanumeric';
  disabled?: boolean;
  label?: string;
  error?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function createPinInput(props: PinInputProps): StackLayout {
  const {
    length = 4, value = '', mask = false,
    type = 'numeric', disabled = false,
    label, error, onChange, onComplete, size = 'md',
  } = props;

  const container = new StackLayout();
  container.className = `clef-widget-pin-input clef-size-${size}`;

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    container.addChild(lbl);
  }

  const fieldsRow = new StackLayout();
  fieldsRow.orientation = 'horizontal';
  fieldsRow.horizontalAlignment = 'center';

  for (let i = 0; i < length; i++) {
    const field = new TextField();
    field.text = value[i] || '';
    field.maxLength = 1;
    field.width = 40;
    field.textAlignment = 'center';
    field.keyboardType = type === 'numeric' ? 'number' : 'text';
    field.secure = mask;
    field.isEnabled = !disabled;
    field.marginRight = 8;
    field.accessibilityLabel = `Digit ${i + 1} of ${length}`;
    fieldsRow.addChild(field);
  }
  container.addChild(fieldsRow);

  if (error) {
    const errLabel = new Label();
    errLabel.text = error;
    errLabel.color = '#ef4444';
    errLabel.fontSize = 12;
    errLabel.horizontalAlignment = 'center';
    container.addChild(errLabel);
  }
  return container;
}

export default createPinInput;
